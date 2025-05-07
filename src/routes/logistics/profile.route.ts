import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import {
  GetProfileInfo,
  UpdateAvatar,
  UpdateProfile,
  UpdateProfileVisibilityStatus,
} from "../../controllers/logistics/profile.controller";
import { validateLogisticsAuth } from "../../middlewares/middlewares";
import multer from "multer";
const upload = multer({
  dest: "./uploads/avatars",
});

const router = Router();

router.get("/", validateLogisticsAuth, errorCatcher(GetProfileInfo));
router.patch("/", validateLogisticsAuth, errorCatcher(UpdateProfile));
router.patch(
  "/visibility",
  validateLogisticsAuth,
  errorCatcher(UpdateProfileVisibilityStatus)
);
router.patch(
  "/avatar",
  validateLogisticsAuth,
  upload.single("avatar"),
  errorCatcher(UpdateAvatar)
);

export default router;
