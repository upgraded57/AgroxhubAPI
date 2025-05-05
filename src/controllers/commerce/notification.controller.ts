import { Prisma, PrismaClient, userType } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../../functions/functions";
import { NotFoundException } from "../../exceptions/not-found";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetNotifications = async (req: Request, res: Response) => {
  const user = req.user;
  const data = await prisma.notification.findMany({
    where: {
      OR: [
        {
          userId: user?.id,
        },
        {
          isGeneral: true,
        },
      ],
    },
  });

  return res.status(200).json({
    status: true,
    message: "Notifications found successfully",
    notifications: data.map((item) => {
      const { isGeneral, userId, ...others } = item;
      return others;
    }),
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
