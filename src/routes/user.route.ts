import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { EditUser, GetUser } from "../controllers/user.controller";
import { validateAuth } from "../middlewares/middlewares";
import multer from "multer";
const upload = multer({
  dest: "./uploads/avatars",
});

import apicache from "apicache";

let cache = apicache.middleware;

const router = Router();

router.get("/:userId", cache("5 minutes"), errorCatcher(GetUser));
router.patch(
  "/:userId",
  validateAuth,
  upload.single("avatar"),
  errorCatcher(EditUser)
);

export default router;
