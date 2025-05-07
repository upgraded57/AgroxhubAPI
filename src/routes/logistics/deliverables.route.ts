import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import {
  GetDeliverables,
  UpdateDeliverables,
} from "../../controllers/logistics/deliverables.controller";
import { GetAllCateories } from "../../controllers/commerce/product.controller";

const router = Router();

router.get("/", validateLogisticsAuth, errorCatcher(GetDeliverables));
router.patch("/", validateLogisticsAuth, errorCatcher(UpdateDeliverables));
router.get("/all", validateLogisticsAuth, errorCatcher(GetAllCateories));

export default router;
