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

export const AddOrderNotes = async (req: Request, res: Response) => {
  const { orderNumber } = req.params;
  const { logisticsNote, sellerNote } = req.body;
  const user = req.user!;

  if (!logisticsNote && !sellerNote) {
    throw new BadRequestException("Please provide notes");
  }
  // fetch order
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  // Check if user owns order
  if (order.userId !== user.id) {
    throw new UnauthorizedException("Cannot update another user's order");
  }

  // Update notes
  await prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      sellerNote: sellerNote ?? undefined,
      logisticsNote: logisticsNote ?? undefined,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Notes added to order successfully",
  });
};

export const GetSingleOrder = async (req: Request, res: Response) => {
  const user = req.user!;
  const { orderNumber } = req.params;

  validateRequiredFields([
    {
      name: "Order Number",
      value: orderNumber,
    },
  ]);

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      userId: user?.id,
    },
    include: {
      deliveryRegion: true,
      orderGroups: {
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          seller: {
            select: {
              name: true,
            },
          },
          logisticsProvider: {
            select: {
              name: true,
              id: true,
              avatar: true,
            },
          },
          orderItems: {
            select: {
              id: true,
              product: {
                select: {
                  slug: true,
                  images: true,
                  name: true,
                  unit: true,
                  ratings: true,
                },
              },
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found!");
  }

  return res.status(200).json({
    status: true,
    message: "Order found successfully",
    order: {
      ...order,
      orderGroups: order?.orderGroups.map((item) => ({
        id: item.id,
        sellerId: item.sellerId,
        status: item.status,
        sellerName: item.seller.name,
        logisticsProviderId: item.logisticsProviderId,
        logisticProvider: item.logisticsProvider,
        logisticsCost: item.logisticsCost,
        deliveryDate: item.deliveryDate,
        orderCompletionCode: item.orderCompletionCode,
        orderItems: item.orderItems.map((entity) => ({
          id: entity.id,
          slug: entity.product.slug,
          image: entity.product.images[0],
          name: entity.product.name,
          ratings: entity.product.ratings,
          quantity: entity.quantity,
          unitPrice: entity.unitPrice,
          unit: entity.product.unit,
          totalPrice: entity.totalPrice,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        })),
      })),
    },
  });
};
