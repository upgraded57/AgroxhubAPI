import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import { GetRegions } from "../../controllers/commerce/region.contoller";
import {
  GetServiceRegions,
  UpdateServiceRegions,
} from "../../controllers/logistics/regions.controller";

const router = Router();

router.get("/all", validateLogisticsAuth, errorCatcher(GetRegions));
router.get("/service", validateLogisticsAuth, errorCatcher(GetServiceRegions));
router.patch(
  "/service",
  validateLogisticsAuth,
  errorCatcher(UpdateServiceRegions)
);

export default router;
