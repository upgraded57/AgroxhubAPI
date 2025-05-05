import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth, validateSeller } from "../../middlewares/middlewares";
import {
  GetNotifications,
  GetSingleNotification,
} from "../../controllers/commerce/notification.controller";

const router = Router();

router.get("/", validateAuth, errorCatcher(GetNotifications));
router.get(
  "/:notificationId",
  validateAuth,
  cache("30 minutes"),
  errorCatcher(GetSingleNotification)
);

export default router;
