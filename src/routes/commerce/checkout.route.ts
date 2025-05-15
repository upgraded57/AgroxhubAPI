import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  CreateOrder,
  GetOrderLogisticsProviders,
  GetSingleOrder,
  UpdateOrderItem,
} from "../../controllers/commerce/checkout.controller";

const router = Router();

router.post("/", validateAuth, errorCatcher(CreateOrder));
router.get("/:orderNumber", validateAuth, errorCatcher(GetSingleOrder));
router.get(
  "/:groupId/providers",
  validateAuth,
  errorCatcher(GetOrderLogisticsProviders)
);
// Update order item
router.patch("/", validateAuth, errorCatcher(UpdateOrderItem));

// Delete order item

export default router;
