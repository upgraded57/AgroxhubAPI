import { Prisma, PrismaClient, userType } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../functions/functions";
import { NotFoundException } from "../exceptions/not-found";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const getSeller = async (req: Request, res: Response) => {
  const { sellerId } = req.params;

  validateRequiredFields([
    {
      name: "Seller Id",
      value: sellerId,
    },
  ]);
  const seller = await prisma.user.findFirst({
    where: {
      id: sellerId,
    },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
    omit: {
      password: true,
    },
  });

  const isSeller =
    seller?.type === userType.farmer || seller?.type === userType.wholesaler;

  if (!isSeller) {
    throw new NotFoundException("Seller not found");
  }

  return res.status(200).json({
    status: true,
    message: "Seller found successfully",
    seller,
  });
};

export const getSellers = async (req: Request, res: Response) => {
  const sellers = await prisma.user.findMany({
    where: {
      OR: [
        {
          type: userType.wholesaler,
        },
        {
          type: userType.farmer,
        },
      ],
    },
  });

  return res.status(200).json({
    status: true,
    message: "Sellers found successfully",
    sellers,
  });
};

export const GetSellerProducts = async (req: Request, res: Response) => {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    rating,
    currentPage = 0,
  } = req.query;

  const { sellerId } = req.params;

  validateRequiredFields([
    {
      name: "User Id",
      value: sellerId,
    },
  ]);

  const seller = await prisma.user.findFirst({
    where: {
      id: sellerId,
    },
    select: {
      name: true,
    },
  });

  if (!seller) {
    throw new NotFoundException("Seller not found");
  }

  const perPage = 32;
  // Subtracting 1 from current page because frontend index is 1 more than needed
  const skipCount =
    currentPage === 0
      ? currentPage * perPage
      : (parseInt(currentPage as string) - 1) * perPage;

  const whereCondition: Prisma.ProductWhereInput = {
    name:
      q && typeof q === "string"
        ? { contains: q, mode: "insensitive" }
        : undefined,

    sellerId: sellerId,

    category:
      category && typeof category === "string" ? { slug: category } : undefined,

    unitPrice:
      minPrice || maxPrice
        ? {
            gte:
              minPrice && typeof minPrice === "string"
                ? parseInt(minPrice)
                : undefined,
            lte:
              maxPrice && typeof maxPrice === "string"
                ? parseInt(maxPrice)
                : undefined,
          }
        : undefined,

    ratings:
      rating && typeof rating === "string" ? parseInt(rating) : undefined,
  };

  const products = await prisma.product.findMany({
    where: whereCondition,
    take: perPage,
    skip: skipCount,
    orderBy: { createdAt: "asc" },
  });

  // Get total count of filtered products
  const totalProducts = await prisma.product.count({
    where: whereCondition, // Apply the same filters
  });

  // Check if there are more products
  const hasMore = skipCount + products.length < totalProducts;

  return res.status(200).json({
    status: true,
    message: "Seller Products found successfully",
    seller,
    products,
    hasMore,
    total: totalProducts,
  });
};

export const GetSellerMostPurchasedProducts = async (
  req: Request,
  res: Response
) => {
  const { sellerId } = req.params;

  validateRequiredFields([
    {
      name: "Seller Id",
      value: sellerId,
    },
  ]);

  const products = await prisma.product.findMany({
    where: {
      sellerId,
    },
    orderBy: {
      purchases: "asc",
    },
    take: 4,
  });

  return res.status(200).json({
    status: true,
    message: "Seller Products found successfully",
    products,
  });
};

export const GetSellerNewestProducts = async (req: Request, res: Response) => {
  const { sellerId } = req.params;

  validateRequiredFields([
    {
      name: "Seller Id",
      value: sellerId,
    },
  ]);

  const products = await prisma.product.findMany({
    where: {
      sellerId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 4,
  });

  return res.status(200).json({
    status: true,
    message: "Seller Products found successfully",
    products,
  });
};

export const GetSimilarSellers = async (req: Request, res: Response) => {
  const { sellerId } = req.params;

  validateRequiredFields([
    {
      name: "Seller Id",
      value: sellerId,
    },
  ]);

  const sellers = await prisma.user.findMany({
    where: {
      id: {
        not: sellerId,
      },
      type: {
        in: [userType.wholesaler, userType.farmer],
      },
    },
    take: 4,
  });

  return res.status(200).json({
    status: true,
    message: "Sellers found successfully",
    sellers,
  });
};
