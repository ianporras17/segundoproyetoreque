import * as M from "./labs.model.js";

const bad = (res, msg) => res.status(400).json({ error: msg });

function mapPg(e, res, next) {
  if (!e?.code) return next(e);
  const m = {
    "23505": [409, "Recurso duplicado"],
    "23503": [400, "Referencia inválida"],
    "23514": [400, "Violación de regla de datos"],
    "22P02": [400, "Dato inválido"],
    "USR_NOT_TECH_OR_ADMIN": [400, "Solo usuarios con rol 'tecnico' (activo) o 'admin' pueden ser responsables"],
  };
  const r = m[e.code];
  return r ? res.status(r[0]).json({ error: r[1], detail: e.detail || e.constraint || e.message }) : next(e);
}

/** ============= LABORATORIOS CRUD ============= */
export async function createLab(req, res, next) {
  try {
    const { nombre, codigo_interno, ubicacion, descripcion = null } = req.body || {};
    if (!nombre || !codigo_interno || !ubicacion) {
      return bad(res, "nombre, codigo_interno y ubicacion son requeridos");
    }
    const out = await M.createLab({ nombre, codigo_interno, ubicacion, descripcion });
    // out = { id, created_at, updated_at }
    return res.status(201).json(out);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

export async function listLabs(_req, res, next) {
  try {
    const list = await M.listLabs(); 
    return res.status(200).json(list);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

export async function getLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const detail = await M.getLab(labId);
    if (!detail) return res.status(404).json({ error: "Laboratorio no encontrado" });
    return res.status(200).json(detail);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

export async function updateLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const patch = pick(req.body, ["nombre", "codigo_interno", "ubicacion", "descripcion"]);
    if (Object.keys(patch).length === 0) return bad(res, "Nada que actualizar");

    const updated = await M.updateLab(labId, patch); // debe hacer SET updated_at = now() en el model
    if (!updated) return res.status(404).json({ error: "Laboratorio no encontrado" });

    // Devuelve el detalle completo consistente con GET /labs/:labId
    const detail = await M.getLab(labId);
    return res.status(200).json(detail);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

function pick(src = {}, allowed = []) {
  const out = {};
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  return out;
}

export async function deleteLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    await M.deleteLab(labId);
    return res.json({ ok: true });
  } catch (e) { return mapPg(e, res, next); }
}

/** ============= TECNICOS_LABS CRUD ============= */
export async function addTechnicianToLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const { usuario_id, activo = true, asignado_hasta = null } = req.body || {};
    if (!usuario_id) return bad(res, "usuario_id requerido");
    await M.assertUserIsTechOrAdmin(usuario_id);

    const out = await M.addTechnicianToLab(labId, {
      usuario_id,
      activo: !!activo,
      asignado_hasta
    });
    return res.status(201).json(out);
  } catch (e) { return mapPg(e, res, next); }
}

export async function listTechniciansOfLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    return res.json(await M.listTechniciansOfLab(labId));
  } catch (e) { return next(e); }
}

export async function updateTechnicianAssignment(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const tecLabId = String(req.params.tecLabId);
    const { cargo, activo, asignado_hasta } = req.body || {};
    const out = await M.updateTechnicianAssignment(labId, tecLabId, { cargo, activo, asignado_hasta });
    return res.json(out); // { id }
  } catch (e) { return mapPg(e, res, next); }
}

export async function removeTechnicianFromLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const tecLabId = String(req.params.tecLabId);
    await M.removeTechnicianFromLab(labId, tecLabId);
    return res.json({ ok: true });
  } catch (e) { return mapPg(e, res, next); }
}

/** ============= REQUISITOS (POLÍTICAS) CRUD ============= */
export async function createPolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const { nombre, descripcion = null, tipo = "otro", obligatorio = true, vigente_desde = null, vigente_hasta = null } = req.body || {};
    if (!nombre) return bad(res, "nombre requerido");
    const out = await M.createPolicy(labId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta });
    return res.status(201).json(out); // { id }
  } catch (e) { return mapPg(e, res, next); }
}

export async function listPolicies(req, res, next) {
  try {
    const labId = String(req.params.labId);
    return res.json(await M.listPolicies(labId));
  } catch (e) { return next(e); }
}

export async function updatePolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const policyId = String(req.params.policyId);
    const { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta } = req.body || {};
    const out = await M.updatePolicy(labId, policyId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta });
    return res.json(out); // { id }
  } catch (e) { return mapPg(e, res, next); }
}

export async function deletePolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const policyId = String(req.params.policyId);
    await M.deletePolicy(labId, policyId);
    return res.json({ ok: true });
  } catch (e) { return mapPg(e, res, next); }
}

/** ============= BITÁCORA ============= */
export async function listHistory(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    return res.json(await M.listHistory(labId, { limit, offset }));
  } catch (e) { return next(e); }
}
