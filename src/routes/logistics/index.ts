import { Router } from "express";

import authRoute from "./auth.route";
import profileRoute from "./profile.route";
import regionsRoute from "./regions.route";
import deliverablesRoute from "./deliverables.route";

const router = Router();
router.use("/auth", authRoute);
router.use("/profile", profileRoute);
router.use("/regions", regionsRoute);
router.use("/deliverables", deliverablesRoute);

export default router;
