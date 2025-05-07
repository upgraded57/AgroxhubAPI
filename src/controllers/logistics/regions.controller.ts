import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { BadRequestException } from "../../exceptions/bad-request";
import { ServerException } from "../../exceptions/server-error";
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

export const UpdateServiceRegions = async (req: Request, res: Response) => {
  const { regionIds } = req.body as { regionIds: string[] };
  const userId = req.userId;

  if (!Array.isArray(regionIds)) {
    throw new BadRequestException("regionIds must be an array.");
  }
  try {
    // 1. Fetch current region IDs from DB
    const existingRegions = await prisma.logisticsProviderRegion.findMany({
      where: {
        logisticsProviderId: userId,
      },
      select: { regionId: true },
    });

    const existingRegionIds = existingRegions.map((r) => r.regionId);

    // 2. Determine which to add or delete
    const regionIdsToAdd = regionIds.filter(
      (id) => !existingRegionIds.includes(id)
    );
    const regionIdsToDelete = existingRegionIds.filter(
      (id) => !regionIds.includes(id)
    );

    // 3. Add new regions
    if (regionIdsToAdd.length > 0) {
      await prisma.logisticsProviderRegion.createMany({
        data: regionIdsToAdd.map((id) => ({
          logisticsProviderId: userId!,
          regionId: id,
        })),
        skipDuplicates: true,
      });
    }

    // 4. Delete regions not in the request
    if (regionIdsToDelete.length > 0) {
      await prisma.logisticsProviderRegion.deleteMany({
        where: {
          regionId: { in: regionIdsToDelete },
        },
      });
    }

    return res.status(200).json({ message: "Regions updated successfully." });
  } catch (error) {
    throw new ServerException("Error updating service regions", error);
  }
};
