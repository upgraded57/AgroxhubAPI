import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  GetLogisticsProvider,
  ReviewLogisticsProvider,
} from "../../controllers/commerce/logistics.controller";

const router = Router();

router.get("/:logisticsId", validateAuth, errorCatcher(GetLogisticsProvider));
router.post(
  "/:logisticsId",
  validateAuth,
  errorCatcher(ReviewLogisticsProvider)
);
export default router;
