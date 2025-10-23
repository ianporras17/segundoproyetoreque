// backend/src/modules/modulo3_3/modulo3_3.controller.js
import {
  createRequest,
  listMyRequests,
  getRequestById,
  deletePendingOwned,
  setStatus,
} from "./modulo3_3.model.js";

/** POST /requests */
export async function createRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id; // viene del middleware requireAuth
    const {
      laboratorio_id,
      recurso_id,
      fecha_uso_inicio,
      fecha_uso_fin,
      motivo,
      adjuntos, // opcional
    } = req.body;

    if (!laboratorio_id || !recurso_id || !fecha_uso_inicio || !fecha_uso_fin) {
      const err = new Error(
        "Faltan campos: laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin"
      );
      err.status = 400;
      throw err;
    }

    const created = await createRequest({
      usuario_id,
      laboratorio_id,
      recurso_id,
      fecha_uso_inicio,
      fecha_uso_fin,
      motivo,
      adjuntos,
    });

    res.status(201).json({
      id: created.id,
      estado: created.estado,
      creada_en: created.creada_en,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /requests?estado=... */
export async function listMyRequestsCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { estado } = req.query;
    const rows = await listMyRequests({ usuario_id, estado });
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

/** GET /requests/:id */
export async function getRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const rol = req.user.rol;
    const { id } = req.params;

    const row = await getRequestById({ id, usuario_id, rol });
    if (!row) {
      const err = new Error("Solicitud no encontrada");
      err.status = 404;
      throw err;
    }

    res.json(row);
  } catch (e) {
    next(e);
  }
}

/** DELETE /requests/:id */
export async function deleteRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;

    const deleted = await deletePendingOwned({ id, usuario_id });
    if (!deleted) {
      const err = new Error(
        "No se puede cancelar: debe ser tu solicitud, en estado 'pendiente' y con fecha futura."
      );
      err.status = 400;
      throw err;
    }

    res.json({ ok: true, id: deleted.id, estado: deleted.estado });
  } catch (e) {
    next(e);
  }
}

/** PATCH /requests/:id/status */
export async function setStatusCtrl(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, aprobada_en } = req.body;

    const rol = req.user.rol;
    if (rol !== "tecnico" && rol !== "admin") {
      const err = new Error("No autorizado");
      err.status = 403;
      throw err;
    }

    const updated = await setStatus({
      id,
      estado,
      aprobada_en,
      actor_user_id: req.user.id,
    });

    if (!updated) {
      const err = new Error("Solicitud no encontrada");
      err.status = 404;
      throw err;
    }

    res.json(updated);
  } catch (e) {
    next(e);
  }
}
