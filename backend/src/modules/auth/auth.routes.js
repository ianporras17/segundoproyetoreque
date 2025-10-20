import { Router } from "express";
import { registerUser, loginUser, meUser, logoutUser } from "./auth.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();
router.post("/register", registerUser);
router.post("/login",    loginUser);
router.post("/logout",   logoutUser);
router.get("/me",        requireAuth, meUser);


export default router;
