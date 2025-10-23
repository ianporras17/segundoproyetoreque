import * as m from "./modulo3_2.model.js";

export async function searchLabs(req, res, next) {
  try {
    const { q, tipo_recurso, ubicacion } = req.query;
    const labs = await m.searchLabs({ q, tipo_recurso, ubicacion });
    res.json(labs);
  } catch (err) { next(err); }
}

export async function listLabResources(req, res, next) {
  try {
    const { labId } = req.params;
    const { date, start, end, tipo, only_available } = req.query;

    // Nota: requisitos de estudiantes se IGNORAN (según tu aclaración)
    const data = await m.listLabResources({
      labId,
      date,
      start,
      end,
      tipo,
      onlyAvailable: String(only_available) === "1",
    });

    res.json(data);
  } catch (err) { next(err); }
}

export async function getLabScheduleRange(req, res, next) {
  try {
    const { labId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from y to son requeridos (YYYY-MM-DD)" });
    }
    const data = await m.getLabScheduleRange({ labId, from, to });
    res.json(data);
  } catch (err) { next(err); }
}

export async function getLabPolicies(req, res, next) {
  try {
    const { labId } = req.params;
    const data = await m.getLabPolicies({ labId });
    res.json(data);
  } catch (err) { next(err); }
}
