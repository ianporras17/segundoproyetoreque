import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { myUsageCtrl, myUsageXlsxCtrl } from "./modulo3_4.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/my-usage", myUsageCtrl);
router.get("/my-usage.xlsx", myUsageXlsxCtrl);

export default router;
