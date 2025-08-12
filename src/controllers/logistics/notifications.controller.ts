import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../../functions/functions";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

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

  validateRequiredFields([
    {
      name: "Notification Id",
      value: notificationId,
    },
  ]);

  const foundNotif = await prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
    select: {
      id: true,
    },
  });

  if (!foundNotif) {
    throw new NotFoundException("Notification not found!");
  }

  const notification = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      unread: false,
    },
  });

  const { isGeneral, userId, ...others } = notification;

  return res.status(200).json({
    status: true,
    message: "Notification found successfully",
    notification: others,
  });
};
