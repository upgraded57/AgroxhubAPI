import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { validateAuth } from "../middlewares/middlewares";
import {
  CreateOrder,
  GetOrder,
  UpdateOrderItem,
} from "../controllers/checkout.controller";

const router = Router();

router.post("/", validateAuth, errorCatcher(CreateOrder));
router.get("/", validateAuth, errorCatcher(GetOrder));
// Update order item
router.patch("/", validateAuth, errorCatcher(UpdateOrderItem));

// Delete order item

export default router;
