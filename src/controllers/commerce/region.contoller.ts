import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { AllRegions } from "../../helpers/regions";
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

export const CreateRegions = async (req: Request, res: Response) => {
  const createdRegions = await prisma.region.createMany({
    data: AllRegions,
  });

  return res.status(200).json({ createdRegions });
};
