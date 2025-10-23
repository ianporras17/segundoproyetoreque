import { pool } from "../../db/index.js";

/** Tablas/columnas según esquema */
const TB = {
  labs: "laboratorios",
  techLabs: "tecnicos_labs",
  users: "users",
  policies: "requisitos",
  history: "historial_laboratorio",
};

const COL = {
  labs: { 
    id: "id"
    , nombre: "nombre"
    , codigo: "codigo_interno"
    , ubicacion: "ubicacion"
    , descripcion: "descripcion"
    , created: "created_at"  
    , updated: "updated_at"  
},
  techLabs: { 
    id: "id"
    , labId: "laboratorio_id"
    , userId: "usuario_id"
    , cargo: "cargo"
    , activo: "activo"
    , desde: "asignado_desde"
    , hasta: "asignado_hasta" 
},
  users: { 
    id: "id"
    , nombre: "nombre"
    , correo: "correo"
    , rol: "rol"
    , activo: "activo"
    , telefono: "telefono" 
},
  policies: { 
    id: "id"
    , labId: "laboratorio_id"
    , nombre: "nombre"
    , descripcion: "descripcion"
    , tipo: "tipo"
    , obligatorio: "obligatorio"
    , desde: "vigente_desde"
    , hasta: "vigente_hasta" },
  history: { 
    id: "id"
    , labId: "laboratorio_id"
    , userId: "usuario_id"
    , accion: "accion"
    , detalle: "detalle"
    , creado: "creado_en" },
};

/* ==================== LABS ==================== */
export async function createLab({ nombre, codigo_interno, ubicacion, descripcion = null }) {
  const { rows } = await pool.query(
    `INSERT INTO ${TB.labs}
       (${COL.labs.nombre}, ${COL.labs.codigo}, ${COL.labs.ubicacion}, ${COL.labs.descripcion})
     VALUES ($1,$2,$3,$4)
     RETURNING
       ${COL.labs.id}      AS id,
       ${COL.labs.created} AS created_at,
       ${COL.labs.updated} AS updated_at`,
    [nombre, codigo_interno, ubicacion, descripcion]
  );
  return rows[0]; 
}

export async function listLabs() {
  const { rows } = await pool.query(
    `SELECT ${COL.labs.id} AS id, ${COL.labs.nombre} AS nombre, ${COL.labs.codigo} AS codigo_interno,
            ${COL.labs.ubicacion} AS ubicacion, ${COL.labs.descripcion} AS descripcion
       FROM ${TB.labs}
      ORDER BY ${COL.labs.nombre} ASC`
  );
  return rows;
}

export async function getLab(labId) {
  const lab = (await pool.query(
    `SELECT
       ${COL.labs.id}        AS id,
       ${COL.labs.nombre}    AS nombre,
       ${COL.labs.codigo}    AS codigo_interno,
       ${COL.labs.ubicacion} AS ubicacion,
       ${COL.labs.descripcion} AS descripcion,
       ${COL.labs.created}   AS created_at,   
       ${COL.labs.updated}   AS updated_at     
     FROM ${TB.labs}
     WHERE ${COL.labs.id}=$1`,
    [labId]
  )).rows[0];
  if (!lab) return null;

  const [techs, policies] = await Promise.all([
    pool.query(
      `SELECT tl.${COL.techLabs.id} AS id,
              u.${COL.users.id} AS usuario_id,
              u.${COL.users.nombre} AS usuario_nombre,
              u.${COL.users.correo} AS usuario_correo,
              u.${COL.users.rol} AS usuario_rol,
              u.${COL.users.telefono} AS usuario_telefono,
              tl.${COL.techLabs.cargo} AS cargo,
              tl.${COL.techLabs.activo} AS activo,
              tl.${COL.techLabs.desde} AS asignado_desde,
              tl.${COL.techLabs.hasta} AS asignado_hasta
         FROM ${TB.techLabs} tl
         JOIN ${TB.users} u ON u.${COL.users.id} = tl.${COL.techLabs.userId}
        WHERE tl.${COL.techLabs.labId} = $1
        ORDER BY tl.${COL.techLabs.desde} DESC, tl.${COL.techLabs.id} ASC`,
      [labId]
    ),
    pool.query(
      `SELECT ${COL.policies.id} AS id,
              ${COL.policies.nombre} AS nombre,
              ${COL.policies.descripcion} AS descripcion,
              ${COL.policies.tipo} AS tipo,
              ${COL.policies.obligatorio} AS obligatorio,
              ${COL.policies.desde} AS vigente_desde,
              ${COL.policies.hasta} AS vigente_hasta
         FROM ${TB.policies}
        WHERE ${COL.policies.labId} = $1
        ORDER BY ${COL.policies.nombre} ASC, ${COL.policies.id} ASC`,
      [labId]
    ),
  ]);

  return { lab, technicians: techs.rows, policies: policies.rows };
}

export async function updateLab(labId, patch) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (patch.nombre != null)      { sets.push(`${COL.labs.nombre}=$${i++}`);      vals.push(patch.nombre); }
  if (patch.codigo_interno != null){ sets.push(`${COL.labs.codigo}=$${i++}`);    vals.push(patch.codigo_interno); }
  if (patch.ubicacion != null)   { sets.push(`${COL.labs.ubicacion}=$${i++}`);   vals.push(patch.ubicacion); }
  if (patch.descripcion != null) { sets.push(`${COL.labs.descripcion}=$${i++}`); vals.push(patch.descripcion); }

  // marca actualización
  sets.push(`${COL.labs.updated}=now()`);

  const sql = `UPDATE ${TB.labs} SET ${sets.join(", ")} WHERE ${COL.labs.id}=$${i} RETURNING
                 ${COL.labs.id} AS id, ${COL.labs.created} AS created_at, ${COL.labs.updated} AS updated_at`;
  vals.push(labId);

  const { rows } = await pool.query(sql, vals);
  return rows[0] || null;
}

export async function deleteLab(labId, byUserId = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Verifica existencia
    const exists = await client.query(
      `SELECT 1 FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
      [labId]
    );
    if (exists.rowCount === 0) {
      const e = new Error("Laboratorio no encontrado");
      e.status = 404;
      throw e;
    }

    // 2) Historial ANTES del borrado (usa un valor permitido en 'accion')
    await client.query(
      `INSERT INTO ${TB.history}
         (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
       VALUES ($1, $2, 'actualizacion_lab', $3::jsonb)`,
      [labId, byUserId, JSON.stringify({ evento: "eliminacion_lab" })]
    );

    // 3) Borrar el laboratorio
    await client.query(
      `DELETE FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
      [labId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


/* ==================== TECNICOS_LABS ==================== */
export async function assertUserIsTechOrAdmin(userId) {
  const q = `
    SELECT ${COL.users.rol} AS rol, ${COL.users.activo} AS activo
    FROM ${TB.users}
    WHERE ${COL.users.id} = $1
  `;
  const { rows, rowCount } = await pool.query(q, [userId]);
  if (!rowCount) {
    const err = new Error("Usuario inexistente");
    err.code = "23503"; // referencia inválida
    throw err;
  }
  const { rol, activo } = rows[0];
  if (rol === "admin") return true;           // admin puede todo
  if (rol === "tecnico" && activo === true) return true; // técnico debe estar activo

  const err = new Error("Solo usuarios con rol 'tecnico' (activo) o 'admin' pueden ser responsables");
  err.code = "USR_NOT_TECH_OR_ADMIN";
  throw err;
}

export async function addTechnicianToLab(labId, { usuario_id, activo, asignado_hasta }) {
  const cargo = "tecnico"; // <- ignoramos lo que venga y forzamos técnico
  const { rows } = await pool.query(
    `INSERT INTO ${TB.techLabs}
      (${COL.techLabs.labId}, ${COL.techLabs.userId}, ${COL.techLabs.cargo},
       ${COL.techLabs.activo}, ${COL.techLabs.hasta})
     VALUES ($1,$2,$3,$4,$5)
     RETURNING ${COL.techLabs.id} AS id`,
    [labId, usuario_id, cargo, activo, asignado_hasta ?? null]
  );

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: rows[0].id, op: "asignado" })]
  );
  return { id: rows[0].id };
}

export async function listTechniciansOfLab(labId) {
  const { rows } = await pool.query(
    `SELECT tl.${COL.techLabs.id} AS id,
            u.${COL.users.id} AS usuario_id,
            u.${COL.users.nombre} AS usuario_nombre,
            u.${COL.users.correo} AS usuario_correo,
            u.${COL.users.rol} AS usuario_rol,
            u.${COL.users.telefono} AS usuario_telefono,
            tl.${COL.techLabs.cargo} AS cargo,
            tl.${COL.techLabs.activo} AS activo,
            tl.${COL.techLabs.desde} AS asignado_desde,
            tl.${COL.techLabs.hasta} AS asignado_hasta
       FROM ${TB.techLabs} tl
       JOIN ${TB.users} u ON u.${COL.users.id} = tl.${COL.techLabs.userId}
      WHERE tl.${COL.techLabs.labId}=$1
      ORDER BY tl.${COL.techLabs.desde} DESC, tl.${COL.techLabs.id} ASC`,
    [labId]
  );
  return rows;
}

export async function updateTechnicianAssignment(labId, tecLabId, { cargo, activo, asignado_hasta }) {
  const sets = [], vals = []; let i = 1;
  if (cargo !== undefined)         { sets.push(`${COL.techLabs.cargo}=$${i++}`); vals.push(cargo); }
  if (activo !== undefined)        { sets.push(`${COL.techLabs.activo}=$${i++}`); vals.push(!!activo); }
  if (asignado_hasta !== undefined){ sets.push(`${COL.techLabs.hasta}=$${i++}`); vals.push(asignado_hasta); }
  if (!sets.length) return { id: tecLabId };

  vals.push(labId, tecLabId);
  const { rowCount } = await pool.query(
    `UPDATE ${TB.techLabs} SET ${sets.join(", ")}
      WHERE ${COL.techLabs.labId}=$${i++} AND ${COL.techLabs.id}=$${i}
      RETURNING ${COL.techLabs.id}`,
    vals
  );

  if (rowCount === 0) {
    const e = new Error("Asignación no encontrada");
    e.status = 404;
    throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: tecLabId, op: "actualizado", /* fields opcional */ })]
  );
  return { id: tecLabId };
}


export async function removeTechnicianFromLab(labId, tecLabId) {
  const { rows, rowCount } = await pool.query(
    `DELETE FROM ${TB.techLabs}
      WHERE ${COL.techLabs.id}=$1 AND ${COL.techLabs.labId}=$2
      RETURNING ${COL.techLabs.id}`,
    [tecLabId, labId]
  );

  if (rowCount === 0) {
    const e = new Error("Asignación no encontrada");
    e.status = 404;
    throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: rows[0].id, op: "removido" })]
  );
}


/* ==================== REQUISITOS (POLÍTICAS) ==================== */
export async function createPolicy(labId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta }) {
  const { rows } = await pool.query(
    `INSERT INTO ${TB.policies}
      (${COL.policies.labId}, ${COL.policies.nombre}, ${COL.policies.descripcion}, ${COL.policies.tipo}, ${COL.policies.obligatorio}, ${COL.policies.desde}, ${COL.policies.hasta})
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${COL.policies.id} AS id`,
    [labId, nombre, descripcion, tipo, !!obligatorio, vigente_desde ?? null, vigente_hasta ?? null]
  );
  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_creada', $2)`,
    [labId, JSON.stringify({ policy_id: rows[0].id })]
  );
  return { id: rows[0].id };
}

export async function listPolicies(labId) {
  const { rows } = await pool.query(
    `SELECT ${COL.policies.id} AS id, ${COL.policies.nombre} AS nombre, ${COL.policies.descripcion} AS descripcion,
            ${COL.policies.tipo} AS tipo, ${COL.policies.obligatorio} AS obligatorio,
            ${COL.policies.desde} AS vigente_desde, ${COL.policies.hasta} AS vigente_hasta
       FROM ${TB.policies}
      WHERE ${COL.policies.labId}=$1
      ORDER BY ${COL.policies.nombre} ASC, ${COL.policies.id} ASC`,
    [labId]
  );
  return rows;
}

export async function updatePolicy(labId, policyId, patch) {
  const { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta } = patch || {};
  const sets = [], vals = []; let i = 1;
  if (nombre !== undefined)         { sets.push(`${COL.policies.nombre}=$${i++}`); vals.push(nombre); }
  if (descripcion !== undefined)    { sets.push(`${COL.policies.descripcion}=$${i++}`); vals.push(descripcion); }
  if (tipo !== undefined)           { sets.push(`${COL.policies.tipo}=$${i++}`); vals.push(tipo); }
  if (obligatorio !== undefined)    { sets.push(`${COL.policies.obligatorio}=$${i++}`); vals.push(!!obligatorio); }
  if (vigente_desde !== undefined)  { sets.push(`${COL.policies.desde}=$${i++}`); vals.push(vigente_desde); }
  if (vigente_hasta !== undefined)  { sets.push(`${COL.policies.hasta}=$${i++}`); vals.push(vigente_hasta); }
  if (!sets.length) return { id: policyId };

  vals.push(labId, policyId);
  const { rowCount } = await pool.query(
    `UPDATE ${TB.policies} SET ${sets.join(", ")}
      WHERE ${COL.policies.labId}=$${i++} AND ${COL.policies.id}=$${i}
      RETURNING ${COL.policies.id}`,
    vals
  );
  if (rowCount === 0) {
    const e = new Error("Política no encontrada");
    e.status = 404; throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_actualizada', $2)`,
    [labId, JSON.stringify({ policy_id: policyId, fields: sets.map(s => s.split("=")[0]) })]
  );
  return { id: policyId };
}


export async function deletePolicy(labId, policyId) {
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.policies}
      WHERE ${COL.policies.id}=$1 AND ${COL.policies.labId}=$2
      RETURNING ${COL.policies.id}`,
    [policyId, labId]
  );
  if (rowCount === 0) {
    const e = new Error("Política no encontrada");
    e.status = 404; throw e;
  }
  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_actualizada', $2)`,
    [labId, JSON.stringify({ policy_id: policyId, op: "deleted" })]
  );
}


/* ==================== HISTORIAL ==================== */
export async function listHistory(labId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COL.history.id} AS id, ${COL.history.userId} AS usuario_id,
            ${COL.history.accion} AS accion, ${COL.history.detalle} AS detalle, ${COL.history.creado} AS creado_en
       FROM ${TB.history}
      WHERE ${COL.history.labId}=$1
      ORDER BY ${COL.history.creado} DESC, ${COL.history.id} DESC
      LIMIT $2 OFFSET $3`,
    [labId, limit, offset]
  );
  return rows;
}
