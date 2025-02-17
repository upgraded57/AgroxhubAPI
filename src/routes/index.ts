import { Router } from "express";

import authRoute from "./auth.route";
import userRoute from "./user.route";
import productRoute from "./product.route";
import regionRoute from "./region.route";
import sellerRoute from "./seller.route";
import saveRoute from "./save.route";
import cartRoute from "./cart.route";

const router = Router();

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/product", productRoute);
router.use("/region", regionRoute);
router.use("/seller", sellerRoute);
router.use("/saves", saveRoute);
router.use("/cart", cartRoute);

export default router;
