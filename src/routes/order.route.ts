import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { validateAuth } from "../middlewares/middlewares";
import { GetOrders } from "../controllers/order.controller";

const router = Router();

router.post("/", validateAuth, errorCatcher(GetOrders));

export default router;
