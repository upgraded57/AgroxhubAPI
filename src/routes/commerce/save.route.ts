import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import {
  GetSavedProducts,
  SaveProduct,
} from "../../controllers/commerce/save.contoller";
import { validateAuth } from "../../middlewares/middlewares";

const router = Router();

router.get("/", validateAuth, errorCatcher(GetSavedProducts));
router.post("/", validateAuth, errorCatcher(SaveProduct));

export default router;
