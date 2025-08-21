import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import moment from "moment";
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

  res.status(200).json({
    status: true,
    message: "Summary found successfully",
    summary: {
      total: summary.length,
      pending: summary.filter((s) => s.status === "pending").length,
      in_transit: summary.filter((s) => s.status === "in_transit").length,
      delivered: summary.filter((s) => s.status === "delivered").length,
      rejected: summary.filter((s) => s.status === "rejected").length,
      balance: summary
        .filter((el) => el.status === "delivered")
        .reduce((acc, s) => (acc += s.logisticsCost || 0), 0),
    },
  });
};

export const GetDeliverySummary = async (req: Request, res: Response) => {
  const userId = req.userId;
  const orders = await prisma.orderGroup.findMany({
    where: {
      logisticsProviderId: userId,
      order: {
        paymentStatus: "paid",
      },
      createdAt: {
        gte: moment().startOf("year").toDate(), // only this year
      },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  // group by last 6 months
  const summary = Array.from({ length: 6 }).map((_, idx) => {
    const month = moment().subtract(idx, "months").startOf("month");

    // filter orders belonging to this month
    const monthlyOrders = orders.filter((order) =>
      moment(order.createdAt).isSame(month, "month")
    );

    return {
      month: month.format("MMM"), // "Mar"
      year: month.format("YYYY"),
      total: monthlyOrders.length,
      delivered: monthlyOrders.filter((el) => el.status === "delivered").length,
    };
  });

  return res.status(200).json({
    status: true,
    message: "Order summary found successfully",
    summary: summary.reverse(),
  });
};

export const GetEarningsSummary = async (req: Request, res: Response) => {
  const userId = req.userId;

  const orders = await prisma.orderGroup.findMany({
    where: {
      logisticsProviderId: userId,
      status: "delivered",
      order: {
        paymentStatus: "paid",
      },
      createdAt: {
        gte: moment().startOf("year").toDate(), // only this year
      },
    },
    select: {
      status: true,
      logisticsCost: true,
      createdAt: true,
    },
  });

  // group by last 6 months
  const summary = Array.from({ length: 6 }).map((_, idx) => {
    const month = moment().subtract(idx, "months").startOf("month");

    // filter orders belonging to this month
    const monthlyOrders = orders.filter((order) =>
      moment(order.createdAt).isSame(month, "month")
    );

    return {
      month: month.format("MMM"), // "Mar"
      year: month.format("YYYY"),
      total: monthlyOrders.reduce((acc, s) => {
        if (s.logisticsCost) return (acc += s.logisticsCost);
        return acc;
      }, 0),
    };
  });

  return res.status(200).json({
    status: true,
    message: "Payment summary found successfully",
    summary: summary.reverse(),
  });
};
