import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { NotFoundException } from "../../exceptions/not-found";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetSummary = async (req: Request, res: Response) => {
  const userId = req.userId;
  const summary = await prisma.orderGroup.findMany({
    where: {
      logisticsProviderId: userId,
      order: {
        paymentStatus: "paid",
      },
    },
    select: {
      status: true,
      logisticsCost: true,
    },
  });

  if (!summary.length) {
    throw new NotFoundException("Unable to fetch summary");
  }

  res.status(200).json({
    status: true,
    message: "Summary found successfully",
    summary: {
      total: summary.length,
      pending: summary.filter((s) => s.status === "pending").length,
      in_transit: summary.filter((s) => s.status === "in_transit").length,
      delivered: summary.filter((s) => s.status === "delivered").length,
      rejected: summary.filter((s) => s.status === "rejected").length,
      balance: summary.reduce((acc, s) => (acc += s.logisticsCost || 0), 0),
    },
  });
};
