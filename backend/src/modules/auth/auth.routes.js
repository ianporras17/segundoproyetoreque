import { Router } from "express";
import { registerUser, loginUser, meUser, logoutUser } from "./auth.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();
router.post("/register", registerUser);
router.post("/login",    loginUser);
router.post("/logout",   logoutUser);
router.get("/me",        requireAuth, meUser);

// Ejemplo de ruta protegida por rol
router.get("/admin/ping", requireAuth, requireRole(["admin"]), (_req, res) => {
  res.json({ ok: true, message: "Hola admin" });
});

export default router;
