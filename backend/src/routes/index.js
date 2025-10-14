// backend/src/routes/index.js
import { Router } from "express";
import { pool } from "../db/index.js";
import { labsRouter } from "../modules/labs/labs.routes.js"; // <--- NUEVO

export const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up", latency_ms: Date.now() - t0 });
  } catch (e) { next(e); }
});

// monta /api/v1/labs/*
router.use("/labs", labsRouter);
