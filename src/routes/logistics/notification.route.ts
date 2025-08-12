import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import { validateLogisticsAuth } from "../../middlewares/middlewares";

const router = Router();
import {
  GetNotifications,
  GetSingleNotification,
} from "../../controllers/logistics/notifications.controller";

router.get("/", validateLogisticsAuth, errorCatcher(GetNotifications));
router.get(
  "/:notificationId",
  validateLogisticsAuth,
  cache("30 minutes"),
  errorCatcher(GetSingleNotification)
);

export default router;
