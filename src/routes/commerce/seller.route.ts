import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import {
  CheckIsFollowing,
  FollowSeller,
  getSeller,
  GetSellerFollowers,
  GetSellerMostPurchasedProducts,
  GetSellerNewestProducts,
  GetSellerOrders,
  GetSellerOrderSummary,
  GetSellerProducts,
  getSellers,
  GetSellerSingleOrder,
  GetSellerSummary,
  GetSimilarSellers,
} from "../../controllers/commerce/seller.controller";
import { validateAuth, validateSeller } from "../../middlewares/middlewares";

const router = Router();

router.get("/", errorCatcher(getSellers));

router.get(
  "/summary/",
  validateAuth,
  validateSeller,
  cache("5 minutes"),
  errorCatcher(GetSellerSummary)
);

router.get(
  "/followers/",
  validateAuth,
  validateSeller,
  cache("5 minutes"),
  errorCatcher(GetSellerFollowers)
);

router.get(
  "/orders/",
  validateAuth,
  validateSeller,
  errorCatcher(GetSellerOrders)
);

router.get(
  "/orders/summary",
  validateAuth,
  validateSeller,
  errorCatcher(GetSellerOrderSummary)
);

router.get(
  "/orders/:orderId",
  validateAuth,
  validateSeller,
  errorCatcher(GetSellerSingleOrder)
);

router.get("/:sellerId", cache("5 minutes"), errorCatcher(getSeller));

router.get("/:sellerId/similar", errorCatcher(GetSimilarSellers));

router.post("/:sellerId/follow", validateAuth, errorCatcher(FollowSeller));

router.get(
  "/:sellerId/isFollowing",
  validateAuth,
  errorCatcher(CheckIsFollowing)
);

router.get(
  "/:sellerId/products",
  // cache("5 minutes"),
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
