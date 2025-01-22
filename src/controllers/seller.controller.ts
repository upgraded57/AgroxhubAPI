import { PrismaClient, userType } from "@prisma/client";
import { Request, Response } from "express";
import {
  findUser,
  uploadAvatar,
  validateFieldType,
  validateRequiredFields,
} from "../functions/functions";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import * as dotenv from "dotenv";
import { ServerException } from "../exceptions/server-error";
import { AllUsers } from "../helpers/users";
import { hashSync } from "bcrypt";
import apicache from "apicache";
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
  const { sellerId } = req.params;
  validateRequiredFields([
    {
      name: "User Id",
      value: sellerId,
    },
  ]);

  const products = await prisma.product.findMany({
    where: {
      seller: {
        id: sellerId,
      },
    },
  });

  return res.status(200).json({
    status: true,
    message: "Products found successfully",
    products,
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
