import { Prisma, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../../functions/functions";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

// Helper type for dynamic includes
type NotificationWithIncludes<T extends object> =
  Prisma.NotificationGetPayload<{ include: T }>;

// Map of includes per type — note `as const` to keep literal typing
const notificationIncludes = {
  follow: {
    user: { select: { id: true, name: true, avatar: true } },
    follower: {
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    },
  },
  productReview: {
    review: {
      include: {
        user: true,
      },
    },
  },
  productSave: {
    product: { select: { id: true, name: true, images: true, slug: true } },
  },
  orderPlacement: {
    order: {
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        deliveryRegion: {
          select: {
            state: true,
            name: true,
            lcda: true,
          },
        },
      },
    },
    orderGroup: {
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    },
  },
  orderPickup: {
    orderGroup: {
      include: {
        logisticsProvider: { select: { id: true, name: true, avatar: true } },
        orderItems: { include: { product: true } },
      },
    },
    order: {
      include: {
        deliveryRegion: {
          select: {
            state: true,
            name: true,
            lcda: true,
          },
        },
      },
    },
  },
  milestone: {},
  orderInTransit: {
    orderGroup: {
      include: {
        logisticsProvider: { select: { id: true, name: true, avatar: true } },
        orderItems: { include: { product: true } },
      },
    },
    order: {
      include: {
        deliveryRegion: {
          select: {
            state: true,
            name: true,
            lcda: true,
          },
        },
      },
    },
  },
  orderDelivery: {
    orderGroup: {
      include: {
        logisticsProvider: { select: { id: true, name: true, avatar: true } },
        orderItems: { include: { product: true } },
      },
    },
    order: {
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        deliveryRegion: {
          select: {
            state: true,
            name: true,
            lcda: true,
          },
        },
      },
    },
    product: true,
  },
  orderAssignment: {
    order: {
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        deliveryRegion: {
          select: {
            state: true,
            name: true,
            lcda: true,
          },
        },
      },
    },
    orderGroup: {
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    },
  },
  outOfStock: {
    product: { select: { id: true, name: true, images: true } },
  },
} as const;

export const GetNotifications = async (req: Request, res: Response) => {
  const userId = req.userId;
  const data = await prisma.notification.findMany({
    where: {
      OR: [
        {
          logisticProviderId: userId,
          target: "logistics",
        },
        {
          isGeneral: true,
        },
      ],
    },
    select: {
      id: true,
      type: true,
      subject: true,
      summary: true,
      createdAt: true,
      unread: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({
    status: true,
    message: "Notifications found successfully",
    notifications: data,
  });
};

export const GetSingleNotification = async (req: Request, res: Response) => {
  const { notificationId } = req.params;

  validateRequiredFields([{ name: "Notification Id", value: notificationId }]);

  // 1️⃣ First query — get type
  const notifMeta = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { type: true },
  });

  if (!notifMeta) {
    throw new NotFoundException("Notification not found!");
  }

  // 2️⃣ Get correct include object
  const includes =
    notificationIncludes[notifMeta.type as keyof typeof notificationIncludes];

  // 3️⃣ Fully type the second query result
  const foundNotif: NotificationWithIncludes<typeof includes> | any = // Should remove "any"
    await prisma.notification.update({
      where: { id: notificationId },
      data: { unread: false },
      include: includes,
    });

  // 4️⃣ Return response safely
  return res.status(200).json({
    status: true,
    message: "Notification found successfully",
    notification: {
      id: foundNotif.id,
      type: foundNotif.type,
      subject: foundNotif.subject,
      summary: foundNotif.summary,
      createdAt: foundNotif.createdAt,
      attachment: foundNotif.attachment,
      unread: foundNotif.unread,
      productQuantity: foundNotif.productQuantity,
      ...(foundNotif.product && {
        product: {
          id: foundNotif.product.id,
          name: foundNotif.product.name,
          image: foundNotif.product.images[0],
          unit: foundNotif.product.unit,
          slug: foundNotif.product.slug,
        },
      }),
      ...(foundNotif.orderGroup && {
        pickupDate: foundNotif.orderGroup.pickupDate,
        deliveryDate: foundNotif.orderGroup.deliveryDate,
      }),
      ...(foundNotif.follower && {
        follower: {
          id: foundNotif.follower.follower.id,
          name: foundNotif.follower.follower.name,
          avatar: foundNotif.follower.follower.avatar,
        },
      }),
      ...(foundNotif.logisticProvider && {
        logisticsProvider: {
          id: foundNotif.logisticProvider.id,
          name: foundNotif.logisticProvider.name,
          avatar: foundNotif.logisticProvider.avatar,
        },
      }),
      ...(foundNotif.order && {
        order: {
          id: foundNotif.order.orderNumber,
          createdAt: foundNotif.order.createdAt,
          amount: foundNotif.order.totalAmount,
          deliveryRegion: foundNotif.order.deliveryRegion,
          deliveryAddress: foundNotif.order.deliveryAddress,
          ...(foundNotif.orderGroup.logisticsCost && {
            logisticsCost: foundNotif.orderGroup.logisticsCost,
          }),
        },
        buyer: {
          id: foundNotif?.order.user?.id,
          name: foundNotif.order.user?.name,
          avatar: foundNotif.order.user?.avatar,
        },
      }),
      ...(foundNotif.orderGroup &&
        foundNotif.orderGroup.orderItems && {
          products: foundNotif.orderGroup.orderItems.map(
            (orderItem: Record<string, any>) => ({
              id: orderItem.id,
              name: orderItem.product.name,
              image: orderItem.product.images[0],
              unit: orderItem.product.unit,
              quantity: orderItem.quantity,
              slug: orderItem.product.slug,
              orderGroupId: foundNotif.orderGroup.id,
            })
          ),
          ...(foundNotif.orderGroup &&
            foundNotif.orderGroup.orderItems && {
              orderGroupId: foundNotif.orderGroup.id,
            }),
          logisticsProvider: {
            id: foundNotif.orderGroup.logisticsProvider?.id,
            name: foundNotif.orderGroup.logisticsProvider?.name,
            avatar: foundNotif.orderGroup.logisticsProvider?.avatar,
          },
          pickupDate: foundNotif.orderGroup.pickupDate,
          deliveryDate: foundNotif.orderGroup.deliveryDate,
        }),
      ...(foundNotif.review && {
        id: foundNotif.review.id,
        rating: foundNotif.review.logisticsRating,
        review: foundNotif.review.logisticsReview,
        user: {
          id: foundNotif.review.user.id,
          name: foundNotif.review.user.name,
          avatar: foundNotif.review.user.avatar,
        },
      }),
    },
  });
};
