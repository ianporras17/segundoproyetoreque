import { Router } from "express";
import { pool } from "../db/index.js";

export const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up", latency_ms: Date.now() - t0 });
  } catch (e) { next(e); }
});
