import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { NotFoundException } from "../../exceptions/not-found";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetReviews = async (req: Request, res: Response) => {
  const userId = req.userId;
  const reviews = await prisma.review.findMany({
    where: {
      logisticsProviderId: userId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!reviews) {
    throw new NotFoundException("Unable to fetch reviews");
  }
  const totalRatings = reviews.reduce(
    (acc, r) =>
      r.logisticsRating ? (acc += parseInt(r.logisticsRating)) : acc,
    0
  );

  res.status(200).json({
    status: true,
    message: "reviews found successfully",
    average: totalRatings / reviews.length,
    reviews: reviews.length
      ? reviews.map((r) => ({
          review: r.logisticsReview,
          rating: r.logisticsRating,
          createdAt: r.createdAt,
          user: {
            id: r.user.id,
            avatar: r.user.avatar,
            name: r.user.name,
          },
        }))
      : [],
  });
};
