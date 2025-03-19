import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import {
  generateOrderNumber,
  validateRequiredFields,
} from "../functions/functions";
import { ServerException } from "../exceptions/server-error";
import { UnauthorizedException } from "../exceptions/unauthorized";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetOrders = async (req: Request, res: Response) => {
  const user = req.user;

  const orders = await prisma.order.findMany({
    where: {
      userId: user?.id,
    },
    // include: {
    //     orderGroups: {
    //         select: {
    //             orderItems: {
    //                 select: {
    //                     _count: true
    //                 }
    //             }
    //         }
    //     }
    // }
  });

  if (!orders) {
    throw new NotFoundException("No orders found!");
  }

  return res.status(200).json({
    status: true,
    message: "Orders found successfully",
    orders,
  });
};
