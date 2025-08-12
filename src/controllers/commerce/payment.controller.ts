import { Order, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { NotFoundException } from "../../exceptions/not-found";
import {
  validateRequiredFields,
  verifyPaystackPayment,
} from "../../functions/functions";
import { ServerException } from "../../exceptions/server-error";
import { paystackInstance } from "../../functions/external";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const InitiatePayment = async (req: Request, res: Response) => {
  const user = req.user;
  const { orderNumber } = req.body;

  validateRequiredFields([
    {
      name: "Order Number",
      value: orderNumber,
    },
  ]);

  // Fetch order
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      userId: user?.id,
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  const data = {
    email: user?.email,
    amount: Math.round(order.totalAmount * 100), // Multiply by 100 to get amount in kobo for paystack
  };
  try {
    const paystackRes = await paystackInstance.post(
      "/transaction/initialize",
      data
    );

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        accessCode: paystackRes.data.data.access_code,
        referenceCode: paystackRes.data.data.reference,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Payment initiated successfully",
      data: paystackRes.data.data,
    });
  } catch (error) {
    console.log(error);
    throw new ServerException("Something went wrong", error);
  }
};

export const VerifyPayment = async (req: Request, res: Response) => {
  const user = req.user;
  const { referenceCode } = req.body;

  validateRequiredFields([
    {
      name: "Reference Code",
      value: referenceCode,
    },
  ]);

  // Check if payment is already verified
  const order = await prisma.order.findFirst({
    where: {
      userId: user?.id,
      referenceCode: referenceCode,
    },
    include: {
      orderGroups: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          seller: {
            select: {
              name: true,
              address: true,
              id: true,
            },
          },
          logisticsProvider: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Cannot find order");
  }

  if (order.paymentStatus === "paid") {
    return res.status(403).json({
      status: false,
      message: "Payment already verified",
      order,
    });
  }

  // Send codes to paystack for verification
  const paymentVerified = await verifyPaystackPayment(referenceCode);

  if (paymentVerified) {
    // Send notice to logistic providers and sellers of order.
    const notificationPromises = order.orderGroups.flatMap((group) => {
      const logisticsNotification = prisma.notification.create({
        data: {
          isGeneral: false,
          target: "logistics",
          logisticProvider: {
            connect: {
              id: group.logisticsProvider!.id,
            },
          },
          type: "orderPlacement",
          subject: `New Order: ${group.orderItems.length} Items Awaiting Pickup`,
          summary: `A new order has been placed containing ${group.orderItems.length} products from ${group.seller.name}. Prepare for pickup`,
          orderGroup: {
            connect: {
              id: group.id,
            },
          },
          order: {
            connect: {
              id: group.orderId,
            },
          },
        },
      });

      const sellerNotifications = group.orderItems.map((item) =>
        prisma.notification.create({
          data: {
            isGeneral: false,
            user: {
              connect: {
                id: group.seller.id,
              },
            },
            product: {
              connect: {
                id: item.product.id,
              },
            },
            productQuantity: item.quantity,
            type: "orderPlacement",
            subject: `New Order: ${item.quantity} ${item.product.name} ordered`,
            summary: `You have a new order: ${item.product.name}. Prepare for pickup.`,
            logisticProvider: {
              connect: {
                id: group.logisticsProviderId!,
              },
            },
            order: {
              connect: {
                id: order.id,
              },
            },
            orderGroup: {
              connect: {
                id: group.id,
              },
            },
          },
        })
      );

      return [logisticsNotification, ...sellerNotifications];
    });
    await prisma.$transaction([
      prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentStatus: "paid",
        },
      }),
      // Delete user's cart
      prisma.cart.deleteMany({
        where: {
          userId: order.userId,
        },
      }),
      ...notificationPromises,
    ]);

    return res.status(200).json({
      status: true,
      message: "Payment verified successfully",
      order,
    });
  } else {
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        paymentStatus: "failed",
      },
    });
    throw new ServerException("Payment was not completed. Please retry");
  }
};
