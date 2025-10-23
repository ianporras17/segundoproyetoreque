import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  searchLabs,
  listLabResources,
  getLabScheduleRange,
  getLabPolicies,
} from "./modulo3_2.controller.js";

const router = Router();

// Todas requieren login (ajusta si alguna debe ser pública)
router.use(requireAuth);

// 3.2.1 Búsqueda por criterios (lab, tipo recurso, ubicación, fecha/horario opcional)
router.get("/labs", searchLabs);

// 3.2.1 + 3.2.2 Recursos del lab (+ filtros avanzados: solo disponibles)
router.get("/labs/:labId/resources", listLabResources);

// 3.2.3 Vista de disponibilidad (horarios + bloqueos / weekly-monthly)
router.get("/labs/:labId/horarios", getLabScheduleRange);

// 3.2.4 Políticas/requisitos del laboratorio
router.get("/labs/:labId/policies", getLabPolicies);

export default router;




