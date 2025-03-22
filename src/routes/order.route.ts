import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { validateAuth } from "../middlewares/middlewares";
import { GetOrders } from "../controllers/order.controller";
import { GetSingleOrder } from "../controllers/checkout.controller";

const router = Router();

router.get("/", validateAuth, errorCatcher(GetOrders));
router.get("/:orderNumber", validateAuth, errorCatcher(GetSingleOrder));

export default router;
