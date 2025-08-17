import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { NotFoundException } from "../../exceptions/not-found";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetLogisticsProvider = async (req: Request, res: Response) => {
  const { logisticsId } = req.params;

  const provider = await prisma.logisticsProvider.findUnique({
    where: {
      id: logisticsId,
    },
    omit: {
      password: true,
    },
  });

  if (!provider) {
    throw new NotFoundException("Logistics provider not found");
  }

  return res.status(200).json({
    status: true,
    message: "Orders found successfully",
    provider,
  });
};

export const ReviewLogisticsProvider = async (req: Request, res: Response) => {
  const user = req.user;
  const { logisticsId } = req.params;
  const { review, rating } = req.body as { review: string; rating: number };

  const provider = await prisma.logisticsProvider.findUnique({
    where: {
      id: logisticsId,
    },
    select: {
      id: true,
    },
  });

  if (!provider) {
    throw new NotFoundException("Logistics provider not found");
  }

  // Create review
  const createdReview = await prisma.review.create({
    data: {
      user: {
        connect: {
          id: user!.id,
        },
      },
      logistic: {
        connect: {
          id: logisticsId,
        },
      },
      logisticsRating: String(rating),
      logisticsReview: review,
    },
  });

  // Send notification to logistic provider
  await prisma.notification.create({
    data: {
      user: {
        connect: {
          id: user!.id,
        },
      },
      isGeneral: false,
      target: "logistics",
      type: "productReview",
      logisticProvider: {
        connect: {
          id: logisticsId,
        },
      },
      review: {
        connect: {
          id: createdReview.id,
        },
      },
      subject: "You have a new review",
      summary:
        "A user just reviewed your service. Check out what the said about you",
    },
  });

  return res.status(201).json({
    status: true,
    message: "Review posted successfully",
  });
};
