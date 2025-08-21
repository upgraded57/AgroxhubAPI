import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import {
  GetDeliverySummary,
  GetEarningsSummary,
  GetSummary,
} from "../../controllers/logistics/summary.controller";

const router = Router();

router.get("/", validateLogisticsAuth, errorCatcher(GetSummary));
router.get("/orders", validateLogisticsAuth, errorCatcher(GetDeliverySummary));
router.get(
  "/earnings",
  validateLogisticsAuth,
  errorCatcher(GetEarningsSummary)
);

export default router;
