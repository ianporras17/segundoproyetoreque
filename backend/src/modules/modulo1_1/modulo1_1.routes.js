import { Router } from "express";
import * as C from "./modulo1_1.controller.js";

export const labsRouter = Router();

/** LABORATORIOS (perfil) */
labsRouter.post("/", C.createLab);
labsRouter.get("/", C.listLabs);
labsRouter.get("/:labId", C.getLab);
labsRouter.patch("/:labId", C.updateLab);
labsRouter.delete("/:labId", C.deleteLab);

/** RESPONSABLES (tecnicos_labs) */
labsRouter.post("/:labId/technicians", C.addTechnicianToLab);
labsRouter.get("/:labId/technicians", C.listTechniciansOfLab);
labsRouter.patch("/:labId/technicians/:tecLabId", C.updateTechnicianAssignment); // opcional (activo/fechas)
labsRouter.delete("/:labId/technicians/:tecLabId", C.removeTechnicianFromLab);

/** POLÍTICAS (requisitos) */
labsRouter.post("/:labId/policies", C.createPolicy);
labsRouter.get("/:labId/policies", C.listPolicies);
labsRouter.patch("/:labId/policies/:policyId", C.updatePolicy);
labsRouter.delete("/:labId/policies/:policyId", C.deletePolicy);

/** BITÁCORA */
labsRouter.get("/:labId/history", C.listHistory);

export default labsRouter;
