import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import { validateRequiredFields } from "../../functions/functions";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetSavedProducts = async (req: Request, res: Response) => {
  const user = req.user;
  const savedProducts = await prisma.savedItem.findMany({
    where: {
      userId: user?.id,
    },
    include: {
      product: true,
    },
  });
  return res.status(200).json({
    status: true,
    message: "Saved products found successfully",
    savedProducts,
  });
};

export const SaveProduct = async (req: Request, res: Response) => {
  const { productId } = req.body;
  const userId = req.user?.id!;

  validateRequiredFields([{ name: "Product ID", value: productId }]);

  // Check if the product exists
  const productExists = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!productExists) {
    throw new NotFoundException("Product not found");
  }

  // Check if the product is already saved by the user
  const savedItem = await prisma.savedItem.findFirst({
    where: { userId, productId },
  });

  if (savedItem) {
    // Remove product if already saved
    await prisma.savedItem.delete({ where: { id: savedItem.id } });
    return res.status(200).json({
      status: true,
      message: "Product removed successfully",
    });
  }

  // Save the product if not already saved
  await prisma.savedItem.create({
    data: {
      userId,
      productId,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Product saved successfully",
  });
};
