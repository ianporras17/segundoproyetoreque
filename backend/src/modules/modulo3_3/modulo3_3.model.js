// backend/src/modules/modulo3_3/modulo3_3.model.js
import { pool } from "../../db/index.js";

/** Crea solicitud (queda 'pendiente'). No hace validaciones automáticas extra. */
export async function createRequest({
  usuario_id,
  laboratorio_id,
  recurso_id,
  fecha_uso_inicio,
  fecha_uso_fin,
  motivo,
  adjuntos,
}) {
  const { rows } = await pool.query(
    `
    INSERT INTO solicitudes (
      usuario_id, laboratorio_id, recurso_id,
      fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos, estado
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente')
    RETURNING id, estado, creada_en
    `,
    [
      usuario_id,
      laboratorio_id,
      recurso_id,
      fecha_uso_inicio,
      fecha_uso_fin,
      motivo ?? null,
      adjuntos ?? null,
    ],
  );
  return rows[0];
}

/** Lista mis solicitudes (opcional: ?estado=...). */
export async function listMyRequests({ usuario_id, estado }) {
  const params = [usuario_id];
  const where = ["s.usuario_id = $1"];
  if (estado) {
    params.push(estado);
    where.push(`s.estado = $${params.length}`);
  }

  const { rows } = await pool.query(
    `
    SELECT
      s.id, s.estado, s.creada_en,
      s.fecha_uso_inicio, s.fecha_uso_fin, s.motivo, s.adjuntos,
      l.id AS lab_id, l.nombre AS lab_nombre,
      r.id AS recurso_id, r.nombre AS recurso_nombre, r.codigo_inventario
    FROM solicitudes s
    JOIN laboratorios  l ON l.id = s.laboratorio_id
    JOIN equipos_fijos r ON r.id = s.recurso_id
    WHERE ${where.join(" AND ")}
    ORDER BY s.creada_en DESC
    `,
    params,
  );
  return rows;
}

/** Obtiene una solicitud por id (si soy dueño o si soy técnico/admin). */
export async function getRequestById({ id, usuario_id, rol }) {
  const params = [id];
  const where = ["s.id = $1"];

  // Si NO es técnico/admin, solo puede ver las suyas
  if (rol !== "tecnico" && rol !== "admin") {
    params.push(usuario_id);
    where.push(`s.usuario_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `
    SELECT
      s.id, s.estado, s.creada_en, s.aprobada_en, s.fecha_devolucion,
      s.fecha_uso_inicio, s.fecha_uso_fin, s.motivo, s.adjuntos,
      s.usuario_id,
      l.id AS lab_id, l.nombre AS lab_nombre, l.ubicacion AS lab_ubicacion,
      r.id AS recurso_id, r.nombre AS recurso_nombre, r.codigo_inventario
    FROM solicitudes s
    JOIN laboratorios  l ON l.id = s.laboratorio_id
    JOIN equipos_fijos r ON r.id = s.recurso_id
    WHERE ${where.join(" AND ")}
    `,
    params,
  );
  return rows[0];
}

/**
 * Cancela una solicitud si:
 *  - Es del usuario,
 *  - Está 'pendiente',
 *  - La fecha de uso aún no empieza.
 * Marca 'cancelada' (delete lógico).
 */
// Delete físico: solo si es del usuario, está 'pendiente' y aún no empezó.
export async function deletePendingOwned({ id, usuario_id }) {
  const { rows } = await pool.query(
    `
    DELETE FROM solicitudes s
     WHERE s.id = $1
       AND s.usuario_id = $2
       AND s.estado = 'pendiente'
       AND s.fecha_uso_inicio > now()
    RETURNING id, 'eliminada'::text AS estado
    `,
    [id, usuario_id],
  );
  return rows[0]; // si no hay filas -> no se pudo cancelar
}


/**
 * Cambia el estado (técnico/admin):
 *  - estado ∈ {'aprobada','rechazada','en_revision'}
 *  - Si 'aprobada', puedes pasar 'aprobada_en' (o se setea now()).
 *  - Si otro estado, 'aprobada_en' queda NULL.
 */
export async function setStatus({ id, estado, aprobada_en, actor_user_id }) {
  // Guardrail por si llega algo raro desde el controller
  const allowed = new Set(["aprobada", "rechazada", "en_revision"]);
  if (!allowed.has(estado)) {
    const err = new Error("Estado inválido");
    err.status = 400;
    throw err;
  }

  const setCols = [`estado = $2`];
  const params  = [id, estado];
  if (estado === "aprobada") {
    setCols.push(`aprobada_en = COALESCE($3, now())`);
    params.push(aprobada_en ?? null);
  } else {
    setCols.push(`aprobada_en = NULL`);
  }

  const { rows } = await pool.query(
    `
    UPDATE solicitudes
       SET ${setCols.join(", ")}
     WHERE id = $1
    RETURNING id, estado, aprobada_en
    `,
    params,
  );
  return rows[0];
}
