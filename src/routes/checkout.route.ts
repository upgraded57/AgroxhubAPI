import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { validateAuth } from "../middlewares/middlewares";
import {
  CreateOrder,
  GetSingleOrder,
  UpdateOrderItem,
} from "../controllers/checkout.controller";

const router = Router();

router.post("/", validateAuth, errorCatcher(CreateOrder));
router.get("/:orderNumber", validateAuth, errorCatcher(GetSingleOrder));
// Update order item
router.patch("/", validateAuth, errorCatcher(UpdateOrderItem));

// Delete order item

export default router;
