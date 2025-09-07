import { Router } from "express";
import apicache from "apicache";

let cache = apicache.middleware;

import { errorCatcher } from "../../middlewares/errors";
import {
  // CreateCategories,
  CreateProduct,
  // createTempProducts,
  DeleteProduct,
  EditProduct,
  GetAllCateories,
  GetAllProducts,
  getRecentProducts,
  GetSimilarProduct,
  GetSingleProduct,
} from "../../controllers/commerce/product.controller";
import { validateAuth, validateSeller } from "../../middlewares/middlewares";
import { upload } from "../../constants/constants";

const router = Router();

router.get("/", errorCatcher(GetAllProducts));
router.get("/recent", errorCatcher(getRecentProducts));
router.get("/categories", cache("10 minutes"), errorCatcher(GetAllCateories));
// router.post("/categories", errorCatcher(CreateCategories));
router.get(
  "/:slug",
  // cache("5 minutes"),
  errorCatcher(GetSingleProduct)
);
router.patch(
  "/:slug",
  validateAuth,
  validateSeller,
  upload.array("images", 4),
  errorCatcher(EditProduct)
);
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
// router.post("/create/many", errorCatcher(createTempProducts));

export default router;
