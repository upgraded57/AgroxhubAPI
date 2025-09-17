import { OrderStatus, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import { validateRequiredFields } from "../../functions/functions";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import moment from "moment";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetOrders = async (req: Request, res: Response) => {
  const userId = req.userId;
  const query = req.query as Record<string, string>;

  const orders = await prisma.orderGroup.findMany({
    where: {
      logisticsProviderId: userId,
      order: {
        paymentStatus: "paid",
      },
      status: (query.status as OrderStatus) ?? undefined,
    },
    include: {
      orderItems: true,
      seller: {
        select: {
          address: true,
        },
      },
      order: {
        select: {
          deliveryAddress: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.status(200).json({
    status: true,
    message: "Orders found successfully",
    orders: orders.map((item) => ({
      id: item.id,
      productsCount: item.orderItems.length,
      pickupAddress: item.seller.address,
      deliveryAddress: item.order.deliveryAddress,
      deliveryDate: item.deliveryDate,
      status: item.status,
      createdAt: item.createdAt,
    })),
  });
};

export const GetSingleOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
      seller: true,
      order: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  res.status(200).json({
    status: true,
    message: "Orders found successfully",
    order: {
      id: order.id,
      pickupAddress: order.seller.address,
      deliveryAddress: order.order.deliveryAddress,
      deliveryCost: order.logisticsCost,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
      logisticsNote: order.order.logisticsNote,
      status: order.status,
      createdAt: order.createdAt,
      user: {
        name: order.order.user.name,
        avatar: order.order.user.avatar,
      },
      products: order.orderItems.map((el) => ({
        name: el.product.name,
        quantity: el.quantity,
        unit: el.product.unit,
        images: el.product.images,
      })),
    },
  });
};

export const UpdateOrderDates = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { date, type } = req.body as {
    date: string;
    type: "pickup" | "delivery";
  };

  validateRequiredFields([
    {
      name: "Date",
      value: date,
    },
    {
      name: "Update Type",
      value: type,
    },
  ]);

  if (type !== "pickup" && type !== "delivery") {
    throw new BadRequestException("Unknown update type provided");
  }

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    include: {
      logisticsProvider: {
        select: {
          name: true,
        },
      },
      order: {
        select: {
          userId: true,
          id: true,
          orderNumber: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      },
      orderItems: {
        select: {
          product: {
            select: {
              name: true,
            },
          },
          quantity: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  if (type === "pickup") {
    await prisma.orderGroup.update({
      where: {
        id: orderId,
      },
      data: {
        pickupDate: new Date(date),
      },
    });

    // Send notice to seller about pickup date
    const notificationPromises = order.orderItems.map((item) => {
      return prisma.notification.create({
        data: {
          isGeneral: false,
          user: {
            connect: {
              id: order.sellerId,
            },
          },
          type: "orderPickup",
          subject: `Order Pickup Notice`,
          summary: `Pickup for ${item.product.name} has been scheduled`,
          logisticProvider: {
            connect: {
              id: order.logisticsProviderId!,
            },
          },
          orderGroup: {
            connect: {
              id: order.id,
            },
          },
          order: {
            connect: {
              id: order.order.id,
            },
          },
        },
      });
    });

    await Promise.all(notificationPromises);
  } else {
    await prisma.orderGroup.update({
      where: {
        id: orderId,
      },
      data: {
        deliveryDate: new Date(date),
      },
    });

    // Send notice to buyer about delivery
    await prisma.notification.create({
      data: {
        isGeneral: false,
        user: {
          connect: {
            id: order.order.userId,
          },
        },
        type: "orderInTransit",
        subject: `Delivery Notice`,
        summary: `Delivery for order ${order.order.orderNumber} has been scheduled`,
        logisticProvider: {
          connect: {
            id: order.logisticsProviderId!,
          },
        },
        order: {
          connect: {
            id: order.order.id,
          },
        },
        orderGroup: {
          connect: {
            id: order.id,
          },
        },
      },
    });
  }

  return res.status(200).json({
    status: true,
    message:
      type === "pickup"
        ? "Pickup date updated successfully"
        : "Delivery date updated successfuly",
  });
};

export const TransitOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
      order: {
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  await prisma.orderGroup.update({
    where: {
      id: orderId,
    },
    data: {
      status: "in_transit",
    },
  });

  // Send transit notification to user
  await prisma.notification.create({
    data: {
      isGeneral: false,
      user: {
        connect: {
          id: order.order.userId,
        },
      },
      type: "orderInTransit",
      subject: `Order in Transit`,
      summary: `Your order (order number - ${
        order.order.orderNumber
      }) is on its way! Expect delivery on ${moment(order.deliveryDate).format(
        "dddd MMM DD, YYYY"
      )}. Ensure to be available for recipient of your order.`,
      order: {
        connect: {
          id: order.order.id,
        },
      },
      orderGroup: {
        connect: {
          id: order.id,
        },
      },
    },
  });

  return res.status(200).json({
    status: true,
    message: "Order transit started successfully",
  });
};

export const CompleteOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { code } = req.body;

  validateRequiredFields([
    {
      name: "Order Completion Code",
      value: code,
    },
  ]);

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    select: {
      sellerId: true,
      status: true,
      id: true,
      orderCompletionCode: true,
      order: {
        select: {
          id: true,
          userId: true,
          orderNumber: true,
        },
      },
      logisticsProviderId: true,
      orderItems: {
        include: {
          product: {
            select: {
              name: true,
              quantity: true,
              low_stock_alert_level: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  if (order.orderCompletionCode !== code) {
    throw new BadRequestException("Order completion code incorrect");
  }

  if (order.status === "delivered") {
    throw new UnauthorizedException("Order already delivered");
  }

  if (order.status !== "in_transit") {
    throw new UnauthorizedException(
      "Please transit order first before completing delivery"
    );
  }

  // Update all products purchases count
  const updatedProductQuantities = order.orderItems.map((item) => {
    return prisma.product.update({
      where: {
        id: item.productId,
      },
      data: {
        purchases: item.quantity,
      },
    });
  });

  const updateOrderGroupStatus = prisma.orderGroup.update({
    where: {
      id: orderId,
    },
    data: {
      status: "delivered",
    },
  });

  // Send delivery notification to buyer
  const logisticsNotification = prisma.notification.create({
    data: {
      isGeneral: false,
      user: {
        connect: {
          id: order.order.userId,
        },
      },
      type: "orderDelivery",
      subject: `Order Delivered Successfully`,
      summary: `Congratulations. Your order (order number - ${order.order.orderNumber}) has been delivered successfully! We hope you like what you got. Please find time to rate seller and logistic service provider.`,
      logisticProvider: {
        connect: {
          id: order.logisticsProviderId!,
        },
      },
      orderGroup: {
        connect: {
          id: order.id,
        },
      },
      order: {
        connect: {
          id: order.order.id,
        },
      },
    },
  });

  // Send delivery notification to seller
  const sellerNotifications = order.orderItems.map((item) => {
    return prisma.notification.create({
      data: {
        isGeneral: false,
        user: {
          connect: {
            id: order.sellerId,
          },
        },
        type: "orderDelivery",
        subject: `Order Delivered Successfully`,
        summary: `Congratulations. ${item.product.name} has been delivered to the buyer successfully!`,
        productQuantity: item.quantity,
        product: {
          connect: {
            id: item.productId,
          },
        },
        logisticProvider: {
          connect: {
            id: order.logisticsProviderId!,
          },
        },
        orderGroup: {
          connect: {
            id: order.id,
          },
        },
        order: {
          connect: {
            id: order.order.id,
          },
        },
      },
    });
  });

  await prisma.$transaction([
    updateOrderGroupStatus,
    logisticsNotification,
    ...sellerNotifications,
    ...updatedProductQuantities,
  ]);

  // Fetch product updated quantities AFTER transaction
  const updatedProducts = await prisma.product.findMany({
    where: {
      id: { in: order.orderItems.map((i) => i.productId) },
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      low_stock_alert_level: true,
      unit: true,
    },
  });

  // Send almost out of stock notifications to seller if needed
  const outOfStockNotifications = updatedProducts
    .filter((p) => p.quantity <= p.low_stock_alert_level)
    .map((p) =>
      prisma.notification.create({
        data: {
          isGeneral: false,
          user: { connect: { id: order.sellerId } },
          type: "outOfStock",
          subject: `Product almost out of stock`,
          summary: `Only ${p.quantity} ${p.unit}${
            p.quantity > 1 ? "s" : ""
          } of ${p.name} is left in your store. Restock now!`,
          productQuantity: p.quantity,
          product: { connect: { id: p.id } },
        },
      })
    );

  // Run notifications outside the first transaction
  await Promise.all(outOfStockNotifications);

  return res.status(200).json({
    status: true,
    message: "Order delivered successfully",
  });
};

export const ReturnOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  validateRequiredFields([
    {
      name: "Return reason",
      value: reason,
    },
  ]);

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    select: {
      sellerId: true,
      status: true,
      id: true,
      orderCompletionCode: true,
      order: {
        select: {
          id: true,
          userId: true,
          orderNumber: true,
        },
      },
      logisticsProviderId: true,
      orderItems: {
        include: {
          product: {
            select: {
              name: true,
              quantity: true,
              low_stock_alert_level: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  if (order.status !== "in_transit") {
    throw new UnauthorizedException(
      "Please transit order first before returning order"
    );
  }

  const updateOrderGroupStatus = prisma.orderGroup.update({
    where: {
      id: orderId,
    },
    data: {
      status: "rejected",
    },
  });

  // Send rejection notification to seller
  const sellerNotifications = prisma.notification.create({
    data: {
      isGeneral: false,
      user: {
        connect: {
          id: order.sellerId,
        },
      },
      type: "orderReturn",
      subject: `Order Rejected`,
      summary: `Unfortunately, order - ${order.order.orderNumber} was rejected by the buyer. Check out their reason`,
      logisticProvider: {
        connect: {
          id: order.logisticsProviderId!,
        },
      },
      orderGroup: {
        connect: {
          id: order.id,
        },
      },
      order: {
        connect: {
          id: order.order.id,
        },
      },
      rejectionReason: reason,
    },
  });

  // Create rejection record in db
  const createRejectRecord = prisma.returnedOrders.create({
    data: {
      orderGroup: {
        connect: {
          id: orderId,
        },
      },
      reason,
      buyer: {
        connect: {
          id: order.order.userId,
        },
      },
    },
  });

  await prisma.$transaction([
    updateOrderGroupStatus,
    sellerNotifications,
    createRejectRecord,
  ]);

  return res.status(200).json({
    status: true,
    message: "Order rejected successfully",
  });
};
