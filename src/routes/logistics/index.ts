import { Router } from "express";

import authRoute from "./auth.route";
import profileRoute from "./profile.route";
import regionsRoute from "./regions.route";
import deliverablesRoute from "./deliverables.route";
import ordersRoute from "./orders.route";
import notificationRoute from "./notification.route";
import summaryRoute from "./summary.route";
import reviewsRoute from "./reviews.route";

const router = Router();
router.use("/auth", authRoute);
router.use("/profile", profileRoute);
router.use("/regions", regionsRoute);
router.use("/deliverables", deliverablesRoute);
router.use("/orders", ordersRoute);
router.use("/notifications", notificationRoute);
router.use("/summary", summaryRoute);
router.use("/reviews", reviewsRoute);

export default router;
