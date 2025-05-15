import { Router } from "express";
import { errorCatcher } from "../../middlewares/errors";
import {
  // CreateRegions,
  GetRegions,
} from "../../controllers/commerce/region.contoller";

const router = Router();

router.get("/", errorCatcher(GetRegions));
// router.post("/", errorCatcher(CreateRegions));

export default router;
