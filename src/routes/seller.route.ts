import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import {
  getSeller,
  GetSellerProducts,
  getSellers,
} from "../controllers/seller.controller";

const router = Router();

router.get("/", errorCatcher(getSellers));
router.get("/:sellerId", errorCatcher(getSeller));
router.get("/:sellerId/products", errorCatcher(GetSellerProducts));

export default router;
