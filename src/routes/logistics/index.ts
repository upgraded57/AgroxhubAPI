import { Router } from "express";

import authRoute from "./auth.route";
import profileRoute from "./profile.route";
import regionsRoute from "./regions.route";

const router = Router();
router.use("/auth", authRoute);
router.use("/profile", profileRoute);
router.use("/regions", regionsRoute);

export default router;
