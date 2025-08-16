import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  CreateReview,
  GetProductReviews,
  GetReview,
} from "../../controllers/commerce/review.controller";

const router = Router();

router.get("/product/:slug", validateAuth, errorCatcher(GetProductReviews));

router.get(
  "/:reviewId",
  validateAuth,
  cache("30 minutes"),
  errorCatcher(GetReview)
);

router.post("/", validateAuth, errorCatcher(CreateReview));

export default router;
