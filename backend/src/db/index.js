import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

pool.connect()
  .then(c => c.query("SELECT 1").then(() => { console.log("[DB] connected"); c.release(); }))
  .catch(err => console.error("[DB] connection error:", err.message));
