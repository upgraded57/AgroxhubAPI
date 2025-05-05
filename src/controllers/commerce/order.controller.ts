import { Order, OrderGroup, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import {
  generateOrderNumber,
  validateRequiredFields,
} from "../../functions/functions";
import { ServerException } from "../../exceptions/server-error";
import { UnauthorizedException } from "../../exceptions/unauthorized";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetOrders = async (req: Request, res: Response) => {
  const user = req.user;

  const orders = await prisma.order.findMany({
    where: {
      userId: user?.id,
    },
    include: {
      orderGroups: {
        select: {
          orderItems: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!orders) {
    throw new NotFoundException("No orders found!");
  }

  // Fucntion to calculate length of products in an order
  const calcProductAmounts = (item: any) => {
    let total = 0;
    item.orderGroups.map((group: any) => {
      total += group.orderItems.length;
    });
    return total;
  };

  return res.status(200).json({
    status: true,
    message: "Orders found successfully",
    orders: orders.map((item) => ({
      createdAt: item.createdAt,
      deliveryAddress: item.deliveryAddress,
      deliveryRegionId: item.deliveryRegionId,
      id: item.id,
      logisticsAmount: item.logisticsAmount,
      products: calcProductAmounts(item),
      orderNumber: item.orderNumber,
      paymentStatus: item.paymentStatus,
      productsAmount: item.productsAmount,
      status: item.status,
      totalAmount: item.totalAmount,
      updatedAt: item.updatedAt,
      userId: item.userId,
    })),
  });
};
