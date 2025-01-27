import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { GetSavedProducts, SaveProduct } from "../controllers/save.contoller";
import { validateAuth } from "../middlewares/middlewares";

const router = Router();

router.get("/", errorCatcher(GetSavedProducts));
router.post("/", validateAuth, errorCatcher(SaveProduct));

export default router;
