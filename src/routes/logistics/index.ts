import { Router } from "express";

import authRoute from "./auth.route";
import profileRoute from "./profile.route";
import regionsRoute from "./regions.route";
import deliverablesRoute from "./deliverables.route";
import ordersRoute from "./orders.route";
import notificationsRoute from "./notification.route";

const router = Router();
router.use("/auth", authRoute);
router.use("/profile", profileRoute);
router.use("/regions", regionsRoute);
router.use("/deliverables", deliverablesRoute);
router.use("/orders", ordersRoute);
router.use("/notifications", notificationsRoute);

export default router;
