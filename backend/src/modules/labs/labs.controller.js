// src/modules/labs/labs.controller.js
import * as M from "./labs.model.js";

// -------- Helpers de validación --------
const EMAIL_INST_REGEX = /^[A-Za-z0-9._%+-]+@((tec|itcr)\.ac\.cr|estudiantec\.cr)$/i;
const EQUIPMENT_STATUS = new Set(["disponible", "reservado", "en_mantenimiento", "inactivo"]);

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

function mapPgErrorToHttp(e, res, next) {
  if (!e || !e.code) return next(e);
  // Postgres error codes
  switch (e.code) {
    case "23505": // unique_violation
      return res.status(409).json({ error: "Recurso duplicado", detail: e.detail || e.constraint });
    case "23514": // check_violation
      return res.status(400).json({ error: "Violación de regla de datos", detail: e.detail || e.constraint });
    case "23503": // foreign_key_violation
      return res.status(400).json({ error: "Referencia inválida", detail: e.detail || e.constraint });
    case "22P02": // invalid_text_representation (ej. enum inválido)
      return res.status(400).json({ error: "Formato de dato inválido", detail: e.detail || e.message });
    default:
      return next(e);
  }
}

// -------- Controllers --------

export async function createLab(req, res, next) {
  try {
    const { department_id, name, internal_code, location, description } = req.body || {};
    if (!department_id || !Number.isInteger(Number(department_id)))
      return badRequest(res, "department_id requerido (entero).");
    if (!name || !internal_code || !location)
      return badRequest(res, "name, internal_code y location son requeridos.");

    const out = await M.createLab({
      department_id: Number(department_id),
      name: String(name).trim(),
      internal_code: String(internal_code).trim(),
      location: String(location).trim(),
      description: description?.toString() || null,
    });
    return res.status(201).json({ id: out.id });
  } catch (e) {
    return mapPgErrorToHttp(e, res, next);
  }
}

export async function getLab(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return badRequest(res, "id inválido.");
    const data = await M.getLabById(id);
    if (!data) return res.status(404).json({ error: "No existe" });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

export async function addContact(req, res, next) {
  try {
    const labId = Number(req.params.id);
    const { full_name, role_title, phone, email, is_primary = false } = req.body || {};

    if (!labId) return badRequest(res, "id de laboratorio inválido.");
    if (!full_name || !role_title || !email)
      return badRequest(res, "full_name, role_title y email son requeridos.");
    if (!EMAIL_INST_REGEX.test(String(email)))
      return badRequest(res, "email debe ser institucional (@itcr.ac.cr, @tec.ac.cr, @estudiantec.cr).");

    const out = await M.addContact(labId, {
      full_name: String(full_name).trim(),
      role_title: String(role_title).trim(),
      phone: phone?.toString() || null,
      email: String(email).trim(),
      is_primary: Boolean(is_primary),
    });
    return res.status(201).json({ id: out.id });
  } catch (e) {
    return mapPgErrorToHttp(e, res, next);
  }
}

export async function addEquipment(req, res, next) {
  try {
    const labId = Number(req.params.id);
    const { inventory_code, name, status = "disponible", last_maintenance } = req.body || {};

    if (!labId) return badRequest(res, "id de laboratorio inválido.");
    if (!inventory_code || !name) return badRequest(res, "inventory_code y name son requeridos.");
    if (!EQUIPMENT_STATUS.has(String(status))) return badRequest(res, "status inválido.");

    const out = await M.addEquipment(labId, {
      inventory_code: String(inventory_code).trim(),
      name: String(name).trim(),
      status: String(status),
      last_maintenance: last_maintenance ? String(last_maintenance) : null,
    });
    return res.status(201).json({ id: out.id });
  } catch (e) {
    return mapPgErrorToHttp(e, res, next);
  }
}

export async function addMaterial(req, res, next) {
  try {
    const labId = Number(req.params.id);
    const { name, unit, initial_stock = 0, reorder_point = 0, current_stock = 0 } = req.body || {};

    if (!labId) return badRequest(res, "id de laboratorio inválido.");
    if (!name || !unit) return badRequest(res, "name y unit son requeridos.");

    const parseNum = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
    const isNonNeg = (n) => Number.isFinite(n) && n >= 0;

    const ist = parseNum(initial_stock);
    const rpt = parseNum(reorder_point);
    const cst = parseNum(current_stock);

    if (!isNonNeg(ist) || !isNonNeg(rpt) || !isNonNeg(cst))
      return badRequest(res, "initial_stock, reorder_point y current_stock deben ser números >= 0.");

    const out = await M.addMaterial(labId, {
      name: String(name).trim(),
      unit: String(unit).trim(),
      initial_stock: ist,
      reorder_point: rpt,
      current_stock: cst,
    });
    return res.status(201).json({ id: out.id });
  } catch (e) {
    return mapPgErrorToHttp(e, res, next);
  }
}

export async function upsertPolicy(req, res, next) {
  try {
    const labId = Number(req.params.id);
    const { requirements, schedule, capacity } = req.body || {};
    if (!labId) return badRequest(res, "id de laboratorio inválido.");

    if (capacity !== undefined && capacity !== null) {
      const cap = Number(capacity);
      if (!Number.isInteger(cap) || cap < 0) return badRequest(res, "capacity debe ser entero >= 0.");
    }

    const out = await M.upsertPolicy(labId, {
      requirements: requirements?.toString() || null,
      schedule: schedule?.toString() || null,
      capacity: capacity !== undefined && capacity !== null ? Number(capacity) : null,
    });
    // out.action: 'created' | 'updated'
    return res.status(out.action === "created" ? 201 : 200).json(out.policy);
  } catch (e) {
    return mapPgErrorToHttp(e, res, next);
  }
}

export async function listHistory(req, res, next) {
  try {
    const labId = Number(req.params.id);
    if (!labId) return badRequest(res, "id de laboratorio inválido.");

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const rows = await M.listHistory(labId, { limit, offset });
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}
