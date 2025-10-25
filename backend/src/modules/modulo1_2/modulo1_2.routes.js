import { Router } from "express";
import * as H from "./modulo1_2.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth);
// 1.2.1 — Horario base semanal (por laboratorio)
router.post("/:labId/horarios", requireRole(["admin"]),  H.createHorario);
router.get("/:labId/horarios", requireRole(["admin"]), H.listHorarios);
router.patch("/:labId/horarios/:slotId", requireRole(["admin"]), H.updateHorario);
router.delete("/:labId/horarios/:slotId", requireRole(["admin"]), H.deleteHorario);

// 1.2.5 — Bitácora del laboratorio
router.get("/:labId/bitacora", requireRole(["admin"]), H.listBitacora);

export default router;
