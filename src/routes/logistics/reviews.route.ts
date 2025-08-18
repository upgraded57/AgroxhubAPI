import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import { GetReviews } from "../../controllers/logistics/reviews.controller";

const router = Router();

router.get("/", validateLogisticsAuth, errorCatcher(GetReviews));

export default router;
