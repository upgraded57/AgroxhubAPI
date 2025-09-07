import { PrismaClient, Review } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
import { NotFoundException } from "../../exceptions/not-found";
import { validateRequiredFields } from "../../functions/functions";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetProductReviews = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const reviews = await prisma.review.findMany({
    where: {
      product: {
        slug,
      },
    },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
          id: true,
          images: true,
          ratings: true,
        },
      },
      user: {
        select: {
          id: true,
          avatar: true,
          name: true,
        },
      },
    },
    omit: {
      logisticsProviderId: true,
      logisticsRating: true,
      userId: true,
      sellerId: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (reviews.length < 1) {
    throw new NotFoundException("Product has no review yet!");
  }

  return res.status(200).json({
    status: true,
    message: "Reviews found successfully",
    reviews: {
      product: reviews?.[0].product,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.productRating,
        review: r.productReview,
        user: {
          id: r.user.id,
          avatar: r.user.avatar,
          name: r.user.name,
        },
        created: r.createdAt,
      })),
    },
  });
};

export const GetReview = async (req: Request, res: Response) => {
  const { id } = req.params;
  const review = await prisma.review.findUnique({
    where: {
      id,
    },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
          id: true,
          images: true,
        },
      },
      user: {
        select: {
          avatar: true,
          name: true,
        },
      },
    },
    omit: {
      logisticsProviderId: true,
      logisticsRating: true,
      userId: true,
      sellerId: true,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Review found successfully",
    review,
  });
};

export const CreateReview = async (req: Request, res: Response) => {
  const user = req.user;
  const { slug, review: productReview, rating } = req.body;

  validateRequiredFields([
    {
      name: "Product slug",
      value: slug,
    },
    {
      name: "Rating",
      value: rating,
    },
  ]);

  const foundProduct = await prisma.product.findUnique({
    where: {
      slug,
    },
    select: {
      id: true,
      name: true,
      ratings: true,
      slug: true,
      sellerId: true,
      reviews: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!foundProduct) {
    throw new NotFoundException("Product not found");
  }

  // Check if same user has reviewed product in the past
  const isReviewed = foundProduct.reviews.find((r) => r.user.id === user!.id);

  let review: Review;

  if (isReviewed && isReviewed.id) {
    review = await prisma.review.update({
      where: {
        id: isReviewed.id,
      },
      data: {
        user: {
          connect: {
            id: user!.id,
          },
        },
        sellerId: foundProduct.sellerId,
        product: {
          connect: {
            slug,
          },
        },
        productRating: String(rating),
        productReview: productReview,
      },
    });
  } else {
    review = await prisma.review.create({
      data: {
        user: {
          connect: {
            id: user!.id,
          },
        },
        sellerId: foundProduct.sellerId,
        product: {
          connect: {
            slug,
          },
        },
        productRating: String(rating),
        productReview: productReview,
      },
    });
  }

  // Send review notification to seller
  await prisma.notification.create({
    data: {
      type: "productReview",
      isGeneral: false,
      user: {
        connect: {
          id: foundProduct.sellerId,
        },
      },
      subject: "A user reviewed your product",
      summary: `${user?.name} reviewed ${foundProduct.name}. Check out what your customer said about your product.`,
      product: {
        connect: {
          id: foundProduct.id,
        },
      },
      review: {
        connect: {
          id: review.id,
        },
      },
    },
  });

  // Update product review count
  await prisma.product.update({
    where: {
      id: foundProduct.id || slug,
    },
    data: {
      ratings: (foundProduct.ratings! + parseInt(rating)) / 2,
    },
  });
  return res.status(201).json({
    status: true,
    message: "Review submitted successfully",
  });
};
