import { Router } from "express";

import authRoute from "./auth.route";
import userRoute from "./user.route";
import productRoute from "./product.route";
import regionRoute from "./region.route";
import sellerRoute from "./seller.route";
import saveRoute from "./save.route";
import cartRoute from "./cart.route";
import notificationRoute from "./notification.route";
import checkoutRoute from "./checkout.route";
import orderRoute from "./order.route";
import paymentRoute from "./payment.route";
import reviewRoute from "./review.route";
import logisticsRoute from "./logistics.route";

const router = Router();
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/product", productRoute);
router.use("/region", regionRoute);
router.use("/seller", sellerRoute);
router.use("/saves", saveRoute);
router.use("/cart", cartRoute);
router.use("/notifications", notificationRoute);
router.use("/checkout", checkoutRoute);
router.use("/order", orderRoute);
router.use("/pay", paymentRoute);
router.use("/reviews", reviewRoute);
router.use("/logistics", logisticsRoute);

export default router;
