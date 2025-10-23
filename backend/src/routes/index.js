import { Router } from "express";
import { pool } from "../db/index.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { labsRouter } from "../modules/modulo1_1/modulo1_1.routes.js";

import modulo3_2 from "../modules/modulo3_2/modulo3_2.routes.js";

export const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up", latency_ms: Date.now() - t0 });
  } catch (e) { next(e); }
});

router.use("/auth", authRoutes);
router.use("/labs", labsRouter);

// 3.2 Búsqueda y disponibilidad
router.use("/search", modulo3_2); 