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
  });

  if (!reviews) {
    throw new NotFoundException("Unable to fetch reviews");
  }

  res.status(200).json({
    status: true,
    message: "reviews found successfully",
    reviews: reviews.length
      ? reviews.map((r) => ({
          review: r.logisticsReview,
          rating: r.logisticsRating,
          createdAt: r.createdAt,
          average: reviews.reduce((acc, r) => {
            let total = 0;
            if (r.logisticsRating) {
              total = acc += parseInt(r.logisticsRating);
            }
            return total / reviews.length;
          }, 0),
          user: {
            id: r.user.id,
            avatar: r.user.avatar,
            name: r.user.name,
          },
        }))
      : [],
  });
};
