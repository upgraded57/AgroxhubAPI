import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import { GetSummary } from "../../controllers/logistics/summary.controller";

const router = Router();

router.get("/", validateLogisticsAuth, errorCatcher(GetSummary));

export default router;
