import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";

import { validateLogisticsAuth } from "../../middlewares/middlewares";
import {
  CompleteOrder,
  GetOrders,
  GetSingleOrder,
  TransitOrder,
  UpdateOrderDates,
} from "../../controllers/logistics/orders.controller";
import multer from "multer";

const router = Router();

const upload = multer({
  dest: "./uploads/pickupMedia",
});

router.get("/", validateLogisticsAuth, errorCatcher(GetOrders));
router.get("/:orderId", validateLogisticsAuth, errorCatcher(GetSingleOrder));
router.patch(
  "/:orderId",
  validateLogisticsAuth,
  errorCatcher(UpdateOrderDates)
);
router.patch(
  "/:orderId/transit",
  upload.array("media"),
  validateLogisticsAuth,
  errorCatcher(TransitOrder)
);
router.patch(
  "/:orderId/complete",
  validateLogisticsAuth,
  errorCatcher(CompleteOrder)
);

export default router;
