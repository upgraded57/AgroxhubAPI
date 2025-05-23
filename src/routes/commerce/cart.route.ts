import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import { validateAuth } from "../../middlewares/middlewares";
import {
  AddItemToCart,
  GetCartItems,
  UpdateCartItem,
  SyncCart,
} from "../../controllers/commerce/cart.contoller";

const router = Router();

router.get("/", validateAuth, errorCatcher(GetCartItems));
router.post("/sync", validateAuth, errorCatcher(SyncCart));
router.post("/add", validateAuth, errorCatcher(AddItemToCart));
router.patch("/", validateAuth, errorCatcher(UpdateCartItem));

export default router;
