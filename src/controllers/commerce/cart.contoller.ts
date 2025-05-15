import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import { validateRequiredFields } from "../../functions/functions";
import { CartItemType } from "../../types/cartItemType";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

const getCartData = async (user: any, message: string, res: Response) => {
  // Fetch updated cart with product details
  const cart = await prisma.cart.findUnique({
    where: { userId: user?.id },
    select: {
      id: true,
      cartItems: {
        include: {
          product: {
            select: { images: true, name: true, unit: true, unitPrice: true },
          },
        },
      },
    },
  });

  return res.status(200).json({
    status: true,
    message,
    cart: cart?.cartItems.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.unitPrice,
      createdAt: item.createdAt,
      slug: item.slug,
      unit: item.product.unit,
      image: item.product.images[0],
      price: item.quantity * item.product.unitPrice,
      cartId: cart.id,
    })),
  });
};

export const SyncCart = async (req: Request, res: Response) => {
  const user = req.user;
  const { cartItems } = req.body;

  // Validate cartItems input
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new BadRequestException("Cart items must be a non-empty array");
  }

  // Validate individual items
  cartItems.forEach((item: Record<string, string>) => {
    if (!item.productSlug) {
      throw new BadRequestException("Product slug is required");
    }
    if (!item.quantity) {
      throw new BadRequestException("Valid product quantity is required");
    }
  });

  // Ensure user has a cart
  const userCart = await prisma.cart.upsert({
    where: { userId: user?.id },
    update: {}, // Do nothing if cart exists
    create: { user: { connect: { id: user?.id } } },
  });

  // Prepare cart items data
  const itemsToCreate: { slug: string; quantity: number; cartId: string }[] =
    cartItems.map((item: CartItemType) => ({
      slug: item.productSlug,
      quantity: parseInt(item.quantity as string),
      cartId: userCart.id,
    }));

  const productSlugs = itemsToCreate.map((item) => item.slug);

  // Check if products exist
  const products = await prisma.product.findMany({
    where: { slug: { in: productSlugs } },
    select: { id: true, slug: true },
  });

  // Create a Map for quick lookup
  const productMap = new Map(products.map((p) => [p.slug, p.id]));

  // Validate if all products exist
  if (products.length !== productSlugs.length) {
    const missingProducts = productSlugs.filter(
      (slug: string) => !productMap.has(slug)
    );
    throw new BadRequestException(
      `Products not found: ${missingProducts.join(", ")}`
    );
  }

  // Insert cart items
  await prisma.cartItem.createMany({
    data: itemsToCreate,
    skipDuplicates: true, // Prevent duplicate inserts
  });

  res.status(200).json({
    status: true,
    message: "Cart synced successfully",
  });
};

export const GetCartItems = async (req: Request, res: Response) => {
  const user = req.user;

  getCartData(user, "Cart found successfully", res);
};

export const AddItemToCart = async (req: Request, res: Response) => {
  const user = req.user;
  const { slug, quantity } = req.body;

  // Validate input fields
  validateRequiredFields([
    { name: "Product Slug", value: slug },
    { name: "Product Quantity", value: quantity },
  ]);

  // Check if product exists
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!product) throw new NotFoundException("Product not found");

  // Ensure the user has a cart
  const userCart = await prisma.cart.upsert({
    where: { userId: user?.id },
    update: {},
    create: { user: { connect: { id: user?.id } } },
  });

  // // Add or Update Cart Item
  // const data = await prisma.cartItem.upsert({
  //   where: { cartId: userCart.id, slug },
  //   update: { quantity: parseInt(quantity) },
  //   create: { slug, quantity: parseInt(quantity), cartId: userCart.id },
  // });

  // check if cartItem is in user cart
  await prisma.cartItem.upsert({
    where: {
      slug_cartId: {
        slug,
        cartId: userCart.id,
      },
    },
    update: {
      quantity: parseInt(quantity),
    },
    create: {
      product: {
        connect: { slug },
      },
      cart: {
        connect: { id: userCart.id },
      },
      quantity: parseInt(quantity),
    },
  });

  getCartData(user, "Product added to cart", res);
};

export const UpdateCartItem = async (req: Request, res: Response) => {
  const user = req.user;
  const {
    slug,
    type,
  }: { slug: string; type: "increment" | "decrement" | "delete" } = req.body;

  validateRequiredFields([{ name: "Product Slug", value: slug }]);

  // Find cart item directly instead of fetching the entire cart
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      cart: { userId: user?.id },
      slug,
    },
    select: { id: true, quantity: true },
  });

  // If product is not in cart, return error
  if (!cartItem) {
    throw new NotFoundException("Product not in cart");
  }

  if (type === "decrement" && cartItem.quantity <= 1) {
    throw new BadRequestException("Cannot decrease product quantity below 1");
  }

  if (type === "increment" && cartItem.quantity >= 10) {
    throw new BadRequestException("Cannot increase product quantity beyond 10");
  }

  // Update quantity
  if (type !== "delete") {
    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: {
        quantity: {
          ...(type === "increment" ? { increment: 1 } : {}),
          ...(type === "decrement" ? { decrement: 1 } : {}),
        },
      },
    });
  } else {
    await prisma.orderItem.delete({
      where: { id: cartItem.id },
    });
  }
  getCartData(user, "Product quantity updated", res);
};
