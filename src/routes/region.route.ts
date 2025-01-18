import { Router } from "express";

import { errorCatcher } from "../middlewares/errors";
import { GetRegions } from "../controllers/region.contoller";

const router = Router();

router.get("/", errorCatcher(GetRegions));

export default router;
