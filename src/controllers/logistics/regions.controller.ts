import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetServiceRegions = async (req: Request, res: Response) => {
  const userId = req.userId;

  const regions = await prisma.logisticsProviderRegion.findMany({
    where: {
      logisticsProviderId: userId,
    },
    select: {
      regionId: true,
    },
  });

  res.status(200).json({
    status: true,
    message: "Service regions found successfully",
    regions,
  });
};

// export const UpdateServiceRegions = async (req: Request, res: Response) => {
//     const [regionsIds] = req.body

//     const updatedRegions = await prisma.logisticsProviderRegion.createMany()
// }
