// backend/src/modules/modulo3_3/modulo3_3.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createRequestCtrl,
  listMyRequestsCtrl,
  getRequestCtrl,
  deleteRequestCtrl,
  setStatusCtrl,
} from "./modulo3_3.controller.js";

const router = Router();

router.use(requireAuth);

// CRUD básico + seguimiento + cancelación
router.post("/",           createRequestCtrl);        // Crear (pendiente)
router.get("/",            listMyRequestsCtrl);       // Mis solicitudes (opc. ?estado)
router.get("/:id",         getRequestCtrl);           // Ver detalle
router.delete("/:id",      deleteRequestCtrl);        // Cancelar propia pendiente

// Cambiar estado (técnico/admin)
router.patch("/:id/status", setStatusCtrl);

export default router;
