import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import {
  CreateProduct,
  DeleteProduct,
  GetAllCateories,
  GetAllProducts,
  getRecentProducts,
  GetSimilarProduct,
  GetSingleProduct,
} from "../../controllers/commerce/product.controller";
import { validateAuth, validateSeller } from "../../middlewares/middlewares";
import multer from "multer";
const upload = multer({
  dest: "./uploads/product-images",
});

const router = Router();

router.get("/", errorCatcher(GetAllProducts));
router.get("/recent", errorCatcher(getRecentProducts));
router.get("/categories", cache("10 minutes"), errorCatcher(GetAllCateories));
router.get("/:slug", cache("5 minutes"), errorCatcher(GetSingleProduct));
router.delete("/:slug", validateAuth, errorCatcher(DeleteProduct));
router.get(
  "/:slug/similar",
  cache("5 minutes"),
  errorCatcher(GetSimilarProduct)
);
router.post(
  "/create",
  validateAuth,
  validateSeller,
  upload.array("images", 4),
  errorCatcher(CreateProduct)
);

export default router;
