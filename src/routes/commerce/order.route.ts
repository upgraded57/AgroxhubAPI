import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  AddOrderNotes,
  GetOrders,
} from "../../controllers/commerce/order.controller";
import { GetSingleOrder } from "../../controllers/commerce/checkout.controller";

const router = Router();

router.get("/", validateAuth, errorCatcher(GetOrders));
router.get("/:orderNumber", validateAuth, errorCatcher(GetSingleOrder));
router.patch("/:orderNumber/notes", validateAuth, errorCatcher(AddOrderNotes));

export default router;
