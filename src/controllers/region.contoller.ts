import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import * as dotenv from "dotenv";
import { UnauthorizedException } from "../exceptions/unauthorized";
import { ForbiddenException } from "../exceptions/forbidden";
import { ServerException } from "../exceptions/server-error";
import { validateRequiredFields } from "../functions/functions";
import { AllRegions } from "../helpers/regions";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetRegions = async (req: Request, res: Response) => {
  const regions = await prisma.region.findMany({
    orderBy: {
      lcda: "asc",
    },
  });
  return res.status(200).json({
    status: true,
    message: "Regions found successfully",
    regions,
  });
};
