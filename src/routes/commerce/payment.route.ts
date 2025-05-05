import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  InitiatePayment,
  VerifyPayment,
} from "../../controllers/commerce/payment.controller";

const router = Router();

router.post("/", validateAuth, errorCatcher(InitiatePayment));
router.post("/verify", validateAuth, errorCatcher(VerifyPayment));

export default router;
