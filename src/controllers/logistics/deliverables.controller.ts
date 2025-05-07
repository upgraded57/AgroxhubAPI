import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { BadRequestException } from "../../exceptions/bad-request";
import { ServerException } from "../../exceptions/server-error";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetDeliverables = async (req: Request, res: Response) => {
  const userId = req.userId;

  const deliverables = await prisma.logisticsProviderCategory.findMany({
    where: {
      logisticsProviderId: userId,
    },
    select: {
      unitCost: true,
      categoryId: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  res.status(200).json({
    status: true,
    message: "Service regions found successfully",
    deliverables: deliverables.map((item) => ({
      categoryName: item.category.name,
      unitCost: item.unitCost,
      categoryId: item.categoryId,
    })),
  });
};

export const UpdateDeliverables = async (req: Request, res: Response) => {
  const data = req.body as { id: string; name: string; unitCost: string }[];
  const userId = req.userId;

  if (!data || !Array.isArray(data)) {
    throw new BadRequestException("Deliverables data required");
  }

  const existing = await prisma.logisticsProviderCategory.findMany({
    where: { logisticsProviderId: userId },
  });

  const existingIds = existing.map((item) => item.categoryId);
  const newIds = data.map((item) => item.id);

  // Determine which to delete, add, and update
  const toDelete = existing.filter((item) => !newIds.includes(item.categoryId));
  const toAdd = data.filter((item) => !existingIds.includes(item.id));
  const toUpdate = data.filter((item) => existingIds.includes(item.id));

  try {
    // Delete
    if (toDelete.length) {
      await prisma.logisticsProviderCategory.deleteMany({
        where: {
          logisticsProviderId: userId,
          categoryId: { in: toDelete.map((d) => d.categoryId) },
        },
      });
    }

    // Add
    if (toAdd.length) {
      await prisma.logisticsProviderCategory.createMany({
        data: toAdd.map((item) => ({
          logisticsProviderId: userId!,
          categoryId: item.id,
          unitCost: parseInt(item.unitCost),
        })),
      });
    }

    // Update (one by one)
    for (const item of toUpdate) {
      await prisma.logisticsProviderCategory.update({
        where: {
          logisticsProviderId_categoryId: {
            logisticsProviderId: userId!,
            categoryId: item.id,
          },
        },
        data: {
          unitCost: parseInt(item.unitCost),
        },
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Deliverables updated successfully" });
  } catch (error) {
    throw new ServerException("Unable to update some deliverables", error);
  }
};
