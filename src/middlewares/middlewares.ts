import { NextFunction, Request } from "express";
import { UnauthorizedException } from "../exceptions/unauthorized";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import jwt from "jsonwebtoken";
import { authTokenPayload } from "../types/function-types";
import { PrismaClient } from "@prisma/client";
import { NotFoundException } from "../exceptions/not-found";
const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const validateAuth = async (
  req: Request,
  _: any,
  next: NextFunction
) => {
  const { authorization } = req.headers;
  if (!authorization || typeof authorization !== "string") {
    return next(new UnauthorizedException("Authorization token not provided"));
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    return next(new UnauthorizedException("Authorization token malformed"));
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_KEY!
    ) as unknown as authTokenPayload;

    const { userId } = payload;
    if (!userId) {
      return next(new UnauthorizedException("Authorization token malformed!"));
    }
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        cart: true,
      },
    });

    if (!user) {
      return next(new NotFoundException("User does not exist"));
    }

    req.user = user;

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return next(
        new UnauthorizedException("Session expired. Please login again")
      );
    }
    return next(new UnauthorizedException("Authorization token malformed"));
  }
};

export const validateSeller = async (
  req: Request,
  _: any,
  next: NextFunction
) => {
  const user = req.user;
  const isSeller = user?.type === "farmer" || user?.type === "wholesaler";

  if (!isSeller) {
    return next(new UnauthorizedException("This action is unauthorized"));
  }

  next();
};
