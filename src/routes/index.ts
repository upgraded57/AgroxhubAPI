import { Router } from "express";

import authRoute from "./auth.route";
import userRoute from "./user.route";
import productRoute from "./product.route";
import regionRoute from "./region.route";
import sellerRoute from "./seller.route";
import saveRoute from "./save.route";

const router = Router();

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/product", productRoute);
router.use("/region", regionRoute);
router.use("/seller", sellerRoute);
router.use("/saves", saveRoute);

export default router;
