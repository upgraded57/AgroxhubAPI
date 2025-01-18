import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import {
  CreateProduct,
  GetAllCateories,
  GetAllProducts,
  GetSingleProduct,
} from "../controllers/product.controller";
import { validateAuth, validateSeller } from "../middlewares/middlewares";
import multer from "multer";
const upload = multer({
  dest: "./uploads/product-images",
});

const router = Router();

router.get("/", errorCatcher(GetAllProducts));
router.get("/categories", errorCatcher(GetAllCateories));
router.get("/:slug", errorCatcher(GetSingleProduct));
router.post(
  "/create",
  validateAuth,
  validateSeller,
  upload.array("images", 4),
  errorCatcher(CreateProduct)
);

export default router;
