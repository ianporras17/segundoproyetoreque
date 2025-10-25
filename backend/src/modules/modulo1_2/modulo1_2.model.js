import { pool } from "../../db/index.js";

/** Tablas / columnas */
const TB = {
  labs: "laboratorios",
  horarios: "laboratorio_horarios",
  history: "historial_laboratorio",
  users: "users",  
};

const COL = {
  labs: {
    id: "id",
  },
  horarios: {
    id: "id",
    labId: "laboratorio_id",
    dow: "dow",
    inicio: "hora_inicio",
    fin: "hora_fin",
    capacidad: "capacidad_maxima",
  },
  users: { id: "id", nombre: "nombre", correo: "correo" },
  history: {
    id: "id", 
    labId: "laboratorio_id",
    accion: "accion",
    userId: "usuario_id",
    detalle: "detalle",
    creado: "creado_en",
  },
};

const DOW_VALIDOS = new Set([0,1,2,3,4,5,6]);

/* ---------- Utilidades ---------- */
export async function assertLabExists(labId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
    [labId]
  );
  if (!rowCount) {
    const err = new Error("Laboratorio no existe");
    err.code = "23503";
    throw err;
  }
}

/** Verifica que no exista traslape con otras franjas del mismo lab/dow */
async function assertNoOverlapHorario(labId, dow, hora_inicio, hora_fin, excludeId = null) {
  const params = [labId, dow, hora_inicio, hora_fin];
  let sql = `
    SELECT 1
      FROM ${TB.horarios}
     WHERE ${COL.horarios.labId}=$1
       AND ${COL.horarios.dow}=$2
       AND NOT (${COL.horarios.fin} <= $3 OR ${COL.horarios.inicio} >= $4)
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND ${COL.horarios.id} <> $5`;
  }
  const { rowCount } = await pool.query(sql, params);
  if (rowCount) {
    const e = new Error("Franja horaria traslapa con otra existente");
    e.code = "OVERLAP_SLOT";
    throw e;
  }
}

/** Registrar en bitácora sin romper la operación principal */
async function logHistorySafe(labId, accion, detalleObj, actorId = null) {
  try {
    await pool.query(
      `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
       VALUES ($1,$2,$3,$4)`,
      [labId, actorId, accion, JSON.stringify(detalleObj)]
    );
  } catch (e) {
    console.error("[HIST] fallo registro:", e.code || e.message);
  }
}

/* ---------- 1.2.1 CRUD de horario base ---------- */

// Crear franja
export async function createHorario(labId, { dow, hora_inicio, hora_fin, capacidad_maxima }) {
  await assertLabExists(labId);

  const d = Number(dow);
  if (!Number.isInteger(d) || !DOW_VALIDOS.has(d)) {
    const e = new Error("dow debe estar entre 0 (domingo) y 6 (sábado)");
    e.code = "22P02"; throw e;
  }
  if (!hora_inicio || !hora_fin) {
    const e = new Error("hora_inicio y hora_fin son requeridos");
    e.code = "22P02"; throw e;
  }
  if (!(Number(capacidad_maxima) > 0)) {
    const e = new Error("capacidad_maxima debe ser > 0");
    e.code = "22P02"; throw e;
  }

  await assertNoOverlapHorario(labId, d, hora_inicio, hora_fin);

  const { rows } = await pool.query(
    `INSERT INTO ${TB.horarios}
       (${COL.horarios.labId}, ${COL.horarios.dow}, ${COL.horarios.inicio}, ${COL.horarios.fin}, ${COL.horarios.capacidad})
     VALUES ($1,$2,$3,$4,$5)
     RETURNING ${COL.horarios.id} AS id`,
    [labId, d, hora_inicio, hora_fin, capacidad_maxima]
  );

  await logHistorySafe(
        labId,
        "actualizacion_lab",
        { tipo: "horario", op: "creado", id: rows[0].id, dow: d, hora_inicio, hora_fin, capacidad_maxima },
        actorId
    );
    return { id: rows[0].id };
}

// Listar franjas de un laboratorio
export async function listHorarios(labId) {
  await assertLabExists(labId);
  const { rows } = await pool.query(
    `SELECT
       ${COL.horarios.id}     AS id,
       ${COL.horarios.dow}    AS dow,
       ${COL.horarios.inicio} AS hora_inicio,
       ${COL.horarios.fin}    AS hora_fin,
       ${COL.horarios.capacidad} AS capacidad_maxima
     FROM ${TB.horarios}
    WHERE ${COL.horarios.labId}=$1
    ORDER BY ${COL.horarios.dow} ASC, ${COL.horarios.inicio} ASC, ${COL.horarios.id} ASC`,
    [labId]
  );
  return rows;
}

// Actualizar franja
export async function updateHorario(labId, slotId, patch = {}) {
  await assertLabExists(labId);

  // Trae valores actuales
  const current = (await pool.query(
    `SELECT ${COL.horarios.dow} AS dow,
            ${COL.horarios.inicio} AS hora_inicio,
            ${COL.horarios.fin} AS hora_fin
       FROM ${TB.horarios}
      WHERE ${COL.horarios.labId}=$1 AND ${COL.horarios.id}=$2`,
    [labId, slotId]
  )).rows[0];
  if (!current) return null;

  const next = {
    dow: (patch.dow !== undefined) ? Number(patch.dow) : Number(current.dow),
    hora_inicio: (patch.hora_inicio !== undefined) ? patch.hora_inicio : current.hora_inicio,
    hora_fin: (patch.hora_fin !== undefined) ? patch.hora_fin : current.hora_fin,
  };

  if (!Number.isInteger(next.dow) || !DOW_VALIDOS.has(next.dow)) {
    const e = new Error("dow debe estar entre 0 y 6");
    e.code = "22P02"; throw e;
  }
  if (patch.capacidad_maxima !== undefined && !(Number(patch.capacidad_maxima) > 0)) {
    const e = new Error("capacidad_maxima debe ser > 0");
    e.code = "22P02"; throw e;
  }

  await assertNoOverlapHorario(labId, next.dow, next.hora_inicio, next.hora_fin, slotId);

  const sets = [], vals = []; let i = 1;
  if (patch.dow !== undefined)               { sets.push(`${COL.horarios.dow}=$${i++}`);    vals.push(next.dow); }
  if (patch.hora_inicio !== undefined)       { sets.push(`${COL.horarios.inicio}=$${i++}`); vals.push(next.hora_inicio); }
  if (patch.hora_fin !== undefined)          { sets.push(`${COL.horarios.fin}=$${i++}`);    vals.push(next.hora_fin); }
  if (patch.capacidad_maxima !== undefined)  { sets.push(`${COL.horarios.capacidad}=$${i++}`); vals.push(patch.capacidad_maxima); }
  if (!sets.length) return { id: slotId };

  vals.push(labId, slotId);

  const { rowCount } = await pool.query(
    `UPDATE ${TB.horarios}
        SET ${sets.join(", ")}
      WHERE ${COL.horarios.labId}=$${i++} AND ${COL.horarios.id}=$${i}
      RETURNING ${COL.horarios.id}`,
    vals
  );
  if (!rowCount) return null;

  await logHistorySafe(
        labId,
        "actualizacion_lab",
        { tipo: "horario", op: "actualizado", id: slotId, patch },
        actorId
    );
    return { id: slotId };
}

// Eliminar franja
export async function deleteHorario(labId, slotId) {
  await assertLabExists(labId);
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.horarios}
     WHERE ${COL.horarios.labId}=$1 AND ${COL.horarios.id}=$2`,
    [labId, slotId]
  );
  if (rowCount) {
    await logHistorySafe(
        labId,
        "actualizacion_lab",
        { tipo: "horario", op: "eliminado", id: slotId },
        actorId
        );
    }
    return !!rowCount;
}

/* ==================== 1.2.5 — LISTADO DE BITÁCORA ==================== */
/**
 * Filtros soportados:
 * - accion: string | string[]  (p.ej: 'alta_equipo', 'cambio_estado_equipo', 'actualizacion_lab', etc.)
 * - desde, hasta: ISO datetime (filtra por creado_en >= desde y < hasta)
 * - equipo_id: UUID del equipo (detalle->>'equipo_id' = $)
 * - tipo: string (p.ej. 'horario' cuando vienen de 1.2.1) (detalle->>'tipo' = $)
 * - q: texto libre (ILIKE en detalle::text)
 * - limit (<=100), offset
 */
export async function listBitacora(
  labId,
  { accion, desde, hasta, equipo_id, tipo, q, limit = 50, offset = 0 } = {}
) {
  await assertLabExists(labId);

  // Saneamiento de límites
  limit = Number(limit);
  offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const where = [`h.${COL.history.labId} = $1`];
  const params = [labId];
  let i = 2;

  if (accion) {
    if (Array.isArray(accion)) {
      where.push(`h.${COL.history.accion} = ANY($${i})`);
      params.push(accion);
      i++;
    } else {
      where.push(`h.${COL.history.accion} = $${i}`);
      params.push(String(accion));
      i++;
    }
  }
  if (desde) {
    where.push(`h.${COL.history.creado} >= $${i}`);
    params.push(desde);
    i++;
  }
  if (hasta) {
    where.push(`h.${COL.history.creado} < $${i}`);
    params.push(hasta);
    i++;
  }
  if (equipo_id) {
    // detalle->>'equipo_id' = 'uuid'
    where.push(`(h.${COL.history.detalle}->>'equipo_id') = $${i}`);
    params.push(String(equipo_id));
    i++;
  }
  if (tipo) {
    // para eventos que guardan detalle.tipo (p.ej. horarios)
    where.push(`(h.${COL.history.detalle}->>'tipo') = $${i}`);
    params.push(String(tipo));
    i++;
  }
  if (q) {
    where.push(`h.${COL.history.detalle}::text ILIKE $${i}`);
    params.push(`%${q}%`);
    i++;
  }

  const sql = `
    SELECT
      h.${COL.history.id}     AS id,
      h.${COL.history.userId} AS usuario_id,
      u.${COL.users.nombre}   AS usuario_nombre,
      u.${COL.users.correo}   AS usuario_correo,
      h.${COL.history.accion} AS accion,
      h.${COL.history.detalle} AS detalle,
      h.${COL.history.creado} AS creado_en
    FROM ${TB.history} h
    LEFT JOIN ${TB.users} u ON u.${COL.users.id} = h.${COL.history.userId}
    WHERE ${where.join(" AND ")}
    ORDER BY h.${COL.history.creado} DESC, h.${COL.history.id} DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}