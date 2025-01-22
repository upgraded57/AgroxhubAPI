import { Request, Response, Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../middlewares/errors";
import {
  getSeller,
  GetSellerMostPurchasedProducts,
  GetSellerNewestProducts,
  GetSellerProducts,
  getSellers,
  GetSimilarSellers,
} from "../controllers/seller.controller";

const router = Router();

router.get("/", errorCatcher(getSellers));
router.get("/:sellerId", cache("5 minutes"), errorCatcher(getSeller));
router.get("/:sellerId/similar", errorCatcher(GetSimilarSellers));
router.get(
  "/:sellerId/products",
  cache("5 minutes"),
  errorCatcher(GetSellerProducts)
);
router.get(
  "/:sellerId/products/mostPurchased",
  cache("5 minutes"),
  errorCatcher(GetSellerMostPurchasedProducts)
);
router.get(
  "/:sellerId/products/newest",
  cache("5 minutes"),
  errorCatcher(GetSellerNewestProducts)
);

export default router;
