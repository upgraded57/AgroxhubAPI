import { Router } from "express";

import { errorCatcher } from "../../middlewares/errors";
import {
  CreateUsers,
  EditUser,
  GetAllUsers,
  GetUser,
} from "../../controllers/commerce/user.controller";
import { validateAuth } from "../../middlewares/middlewares";
import multer from "multer";
const upload = multer({
  dest: "./uploads/avatars",
});

const router = Router();

router.get("/", validateAuth, errorCatcher(GetUser));
router.post("/", errorCatcher(CreateUsers));
router.get("/all", errorCatcher(GetAllUsers));
router.patch(
  "/",
  validateAuth,
  upload.single("avatar"),
  errorCatcher(EditUser)
);

export default router;
