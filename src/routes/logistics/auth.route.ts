import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import {
  ActivateAccount,
  ResendActivationLink,
  Login,
  Register,
} from "../../controllers/logistics/auth.controller";

const router = Router();

router.post("/login", errorCatcher(Login));

router.post("/register", errorCatcher(Register));

router.post("/activate-account", errorCatcher(ActivateAccount));

router.post("/resend-token", errorCatcher(ResendActivationLink));

export default router;
