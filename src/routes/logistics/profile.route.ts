import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { GetProfileInfo } from "../../controllers/logistics/profile.controller";
import { validateLogisticsAuth } from "../../middlewares/middlewares";

const router = Router();

router.get("/:accountId", validateLogisticsAuth, errorCatcher(GetProfileInfo));

export default router;
