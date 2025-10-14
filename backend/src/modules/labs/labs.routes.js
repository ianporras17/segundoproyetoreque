// src/modules/labs/labs.routes.js
import { Router } from "express";
import * as C from "./labs.controller.js";

export const labsRouter = Router();

// Perfil
labsRouter.post("/", C.createLab);
labsRouter.get("/:id", C.getLab);

// Contactos
labsRouter.post("/:id/contacts", C.addContact);

// Equipos (recursos fijos)
labsRouter.post("/:id/equipment", C.addEquipment);

// Materiales (consumibles)
labsRouter.post("/:id/materials", C.addMaterial);

// Políticas internas (upsert)
labsRouter.put("/:id/policy", C.upsertPolicy);

// Historial / bitácora
labsRouter.get("/:id/history", C.listHistory);

export default labsRouter;
