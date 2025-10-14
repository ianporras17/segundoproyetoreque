// src/modules/labs/labs.model.js
import { pool } from "../../db/index.js";

// Crea perfil de laboratorio + log
export async function createLab({ department_id, name, internal_code, location, description }) {
  const { rows } = await pool.query(
    `INSERT INTO lab(department_id, name, internal_code, location, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [department_id, name, internal_code, location, description]
  );
  const labId = rows[0].id;
  await pool.query(
    `INSERT INTO lab_history(lab_id, action, meta)
     VALUES ($1,'perfil_creado', $2)`,
    [labId, JSON.stringify({ internal_code })]
  );
  return { id: labId };
}

// Detalle completo del lab (perfil + depto + colecciones + política)
export async function getLabById(id) {
  const lab = (await pool.query(
    `SELECT l.*, d.name AS department_name
       FROM lab l
       JOIN department d ON d.id = l.department_id
      WHERE l.id = $1`,
    [id]
  )).rows[0];
  if (!lab) return null;

  const [contacts, equipment, materials, policy] = await Promise.all([
    pool.query(`SELECT * FROM lab_contact  WHERE lab_id=$1 ORDER BY is_primary DESC, id ASC`, [id]),
    pool.query(`SELECT * FROM lab_equipment WHERE lab_id=$1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT * FROM lab_material  WHERE lab_id=$1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT * FROM lab_policy   WHERE lab_id=$1 LIMIT 1`, [id]),
  ]);

  return {
    lab,
    contacts: contacts.rows,
    equipment: equipment.rows,
    materials: materials.rows,
    policies: policy.rows[0] ?? null,
  };
}

// Agrega contacto (si es principal, desmarca los demás en una transacción)
export async function addContact(lab_id, { full_name, role_title, phone, email, is_primary }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (is_primary) {
      await client.query(
        `UPDATE lab_contact SET is_primary = FALSE WHERE lab_id = $1 AND is_primary = TRUE`,
        [lab_id]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO lab_contact(lab_id, full_name, role_title, phone, email, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [lab_id, full_name, role_title, phone, email, is_primary]
    );
    await client.query(
      `INSERT INTO lab_history(lab_id, action, meta)
       VALUES ($1,'responsable_agregado', $2)`,
      [lab_id, JSON.stringify({ contact_id: rows[0].id })]
    );
    await client.query("COMMIT");
    return { id: rows[0].id };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Agrega equipo (recurso fijo) + log
export async function addEquipment(lab_id, { inventory_code, name, status, last_maintenance }) {
  const { rows } = await pool.query(
    `INSERT INTO lab_equipment(lab_id, inventory_code, name, status, last_maintenance)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [lab_id, inventory_code, name, status, last_maintenance]
  );
  await pool.query(
    `INSERT INTO lab_history(lab_id, action, meta)
     VALUES ($1,'equipo_registrado', $2)`,
    [lab_id, JSON.stringify({ equipment_id: rows[0].id, inventory_code })]
  );
  return { id: rows[0].id };
}

// Agrega material (consumible) + log
export async function addMaterial(lab_id, { name, unit, initial_stock, reorder_point, current_stock }) {
  const { rows } = await pool.query(
    `INSERT INTO lab_material(lab_id, name, unit, initial_stock, reorder_point, current_stock)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [lab_id, name, unit, initial_stock, reorder_point, current_stock]
  );
  await pool.query(
    `INSERT INTO lab_history(lab_id, action, meta)
     VALUES ($1,'material_registrado', $2)`,
    [lab_id, JSON.stringify({ material_id: rows[0].id, name })]
  );
  return { id: rows[0].id };
}

// Crea/actualiza políticas (1 registro por lab) + log
export async function upsertPolicy(lab_id, { requirements, schedule, capacity }) {
  // Primero intentamos actualizar
  const upd = await pool.query(
    `UPDATE lab_policy
        SET requirements = $2, schedule = $3, capacity = $4
      WHERE lab_id = $1
    RETURNING id`,
    [lab_id, requirements, schedule, capacity]
  );
  if (upd.rowCount > 0) {
    const policy = (await pool.query(`SELECT * FROM lab_policy WHERE id=$1`, [upd.rows[0].id])).rows[0];
    await pool.query(
      `INSERT INTO lab_history(lab_id, action, meta)
       VALUES ($1,'politica_actualizada', $2)`,
      [lab_id, JSON.stringify({ policy_id: policy.id })]
    );
    return { action: "updated", policy };
  }

  // Si no existe, insertamos
  const ins = await pool.query(
    `INSERT INTO lab_policy(lab_id, requirements, schedule, capacity)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [lab_id, requirements, schedule, capacity]
  );
  const policy = (await pool.query(`SELECT * FROM lab_policy WHERE id=$1`, [ins.rows[0].id])).rows[0];
  await pool.query(
    `INSERT INTO lab_history(lab_id, action, meta)
     VALUES ($1,'politica_creada', $2)`,
    [lab_id, JSON.stringify({ policy_id: policy.id })]
  );
  return { action: "created", policy };
}

// Historial / bitácora (paginado opcional)
export async function listHistory(lab_id, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, lab_id, user_email, action, meta, created_at
       FROM lab_history
      WHERE lab_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [lab_id, limit, offset]
  );
  return rows;
}

export default {
  createLab,
  getLabById,
  addContact,
  addEquipment,
  addMaterial,
  upsertPolicy,
  listHistory,
};
