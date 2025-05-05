import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import { GetRegions } from "../../controllers/commerce/region.contoller";
import { GetServiceRegions } from "../../controllers/logistics/regions.controller";

const router = Router();

router.get("/all", validateLogisticsAuth, errorCatcher(GetRegions));
router.get("/service", validateLogisticsAuth, errorCatcher(GetServiceRegions));

export default router;
