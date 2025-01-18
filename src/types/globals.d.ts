import { User } from "@prisma/client";
import * as Express from "express";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
