import { Router } from "express";
import {
  ForgotPassword,
  Login,
  ResendOtp,
  ResetPassword,
  Signup,
  VerifyOtp,
  VerifyResetOtp,
} from "../controllers/auth.controller";
import { errorCatcher } from "../middlewares/errors";

const router = Router();

router.post("/login", errorCatcher(Login));
router.post("/signup", errorCatcher(Signup));
router.post("/verify-otp", errorCatcher(VerifyOtp));
router.post("/forgot-password", errorCatcher(ForgotPassword));
router.post("/verify-reset-otp", errorCatcher(VerifyResetOtp));
router.post("/reset-password", errorCatcher(ResetPassword));
router.post("/resend-otp", errorCatcher(ResendOtp));

export default router;
