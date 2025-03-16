import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import { validateRequiredFields } from "../functions/functions";
import { ServerException } from "../exceptions/server-error";
import { UnauthorizedException } from "../exceptions/unauthorized";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const CreateOrder = async (req: Request, res: Response) => {
  const { deliveryAddress, deliveryRegionId, cartId } = req.body;
  const user = req?.user;

  validateRequiredFields([
    { name: "Cart Id", value: cartId },
    { name: "Delivery Address", value: deliveryAddress },
    { name: "Delivery Region", value: deliveryRegionId },
  ]);

  // Check if region exists
  const regionExists = await prisma.region.findUnique({
    where: { id: deliveryRegionId },
  });
  if (!regionExists)
    throw new BadRequestException("Supplied region does not exist!");

  // Get all products from cart
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      cartItems: {
        select: {
          id: true,
          quantity: true,
          product: {
            select: { id: true, unitPrice: true, sellerId: true },
          },
        },
      },
    },
  });

  if (!cart || cart.cartItems.length < 1)
    throw new BadRequestException("Cart is empty or cannot be processed");

  // Group products by sellerId
  const groupedProducts = cart.cartItems.reduce((acc, cartItem) => {
    const { id: productId, unitPrice, sellerId } = cartItem.product;
    const group = acc[sellerId] || [];

    group.push({
      productId,
      quantity: cartItem.quantity,
      unitPrice,
      totalPrice: cartItem.quantity * unitPrice,
    });

    acc[sellerId] = group;
    return acc;
  }, {} as Record<string, { productId: string; quantity: number; unitPrice: number; totalPrice: number }[]>);

  // Calculate total amount
  const productsAmount = Object.values(groupedProducts)
    .flat()
    .reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate logistics amount
  const logisticsAmount = 3000;

  // Calculate vat
  const vat = 0.1 * productsAmount;

  // Step 1: Create the Order (without orderGroups)
  const order = await prisma.order.create({
    data: {
      user: { connect: { id: user?.id } },
      deliveryAddress,
      deliveryRegion: { connect: { id: deliveryRegionId } },
      productsAmount,
      logisticsAmount,
      vat,
      totalAmount: productsAmount + logisticsAmount + vat,
    },
  });

  // Step 2: Update the Order to add Order Groups & Order Items
  await prisma.order.update({
    where: { id: order.id },
    data: {
      orderGroups: {
        create: Object.entries(groupedProducts).map(([sellerId, items]) => ({
          seller: { connect: { id: sellerId } },
          orderItems: {
            create: items.map((item) => ({
              order: { connect: { id: order.id } }, // Explicitly link order
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        })),
      },
    },
    include: { orderGroups: { include: { orderItems: true } } },
  });

  return res
    .status(201)
    .json({ status: true, message: "Order created successfully", order });
};

export const GetOrder = async (req: Request, res: Response) => {
  const user = req.user!;

  const order = await prisma.order.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      deliveryRegion: true,
      orderGroups: {
        include: {
          seller: {
            select: {
              name: true,
            },
          },
          orderItems: {
            select: {
              id: true,
              product: {
                select: {
                  slug: true,
                  images: true,
                  name: true,
                  unit: true,
                },
              },
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  return res.status(200).json({
    status: true,
    message: "Order found successfully",
    order: {
      ...order,
      orderGroups: order?.orderGroups.map((item) => ({
        id: item.id,
        sellerId: item.sellerId,
        status: item.status,
        sellerName: item.seller.name,
        logisticsProviderId: item.logisticsProviderId,
        // Logistic information to be destructed here later
        orderItems: item.orderItems.map((entity) => ({
          id: entity.id,
          slug: entity.product.slug,
          image: entity.product.images[0],
          name: entity.product.name,
          quantity: entity.quantity,
          unitPrice: entity.unitPrice,
          unit: entity.product.unit,
          totalPrice: entity.totalPrice,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        })),
      })),
    },
  });
};

export const UpdateOrderItem = async (req: Request, res: Response) => {
  const user = req.user;
  const { type, itemId } = req.body;

  validateRequiredFields([
    { name: "Update Type", value: type },
    { name: "Item Id", value: itemId },
  ]);

  // Check update type
  if (type !== "increment" && type !== "decrement" && type !== "delete") {
    throw new BadRequestException("Unknown update type provided");
  }

  // Find product to update first
  const productToUpdate = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: {
      product: {
        select: {
          unitPrice: true, //Selecting product unit price from product to always get current product price
        },
      },
      order: {
        select: {
          id: true,
          userId: true,
        },
      },
    }, // Include product and order details
  });

  if (!productToUpdate) {
    throw new NotFoundException("Product not in order!");
  }

  const { order } = productToUpdate;

  if (user?.id !== order.userId) {
    throw new UnauthorizedException("This action is unauthorized");
  }

  // Validate quantity updates
  if (type === "decrement" && productToUpdate.quantity <= 1) {
    throw new BadRequestException("Cannot decrease product quantity below 1");
  }

  if (type === "increment" && productToUpdate.quantity >= 10) {
    throw new BadRequestException("Cannot increase product quantity beyond 10");
  }

  let newProductToUpdatePrice: number = 0;
  if (type === "increment") {
    newProductToUpdatePrice =
      (productToUpdate.quantity + 1) * productToUpdate.product.unitPrice;
  }
  if (type === "decrement") {
    newProductToUpdatePrice =
      (productToUpdate.quantity - 1) * productToUpdate.product.unitPrice;
  }

  try {
    // Update quantity
    if (type !== "delete") {
      await prisma.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: {
            ...(type === "increment" ? { increment: 1 } : {}),
            ...(type === "decrement" ? { decrement: 1 } : {}),
          },
          totalPrice: newProductToUpdatePrice,
        },
      });
    } else {
      await prisma.orderItem.delete({
        where: { id: itemId },
      });
    }

    // Check if order still has items in it
    const remainingItems = await prisma.orderItem.count({
      where: { orderId: order.id },
    });

    if (remainingItems === 0) {
      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      return res.status(200).json({
        status: true,
        message:
          type === "delete"
            ? "Product deleted successfully"
            : `Quantity ${type}ed successfully`,
      });
    }

    // Recalculate total order price
    // Step 1: Select all products in order
    const allProducts = await prisma.order.findUnique({
      where: {
        id: order.id,
      },
      select: {
        logisticsAmount: true,
        orderGroups: {
          select: {
            orderItems: {
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    });

    // Step 2: Recalculate total price
    let newProductsAmount = 0;
    allProducts?.orderGroups?.map((group) => {
      group.orderItems.map((item) => {
        newProductsAmount += item.quantity * item.unitPrice;
      });
    });

    const newVat = 0.1 * newProductsAmount;

    const newTotalAmount =
      newProductsAmount + newVat + allProducts?.logisticsAmount!;

    // Step 3: Update order with new amount
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        productsAmount: newProductsAmount,
        vat: newVat,
        totalAmount: newTotalAmount,
      },
    });

    return res.status(200).json({
      status: true,
      message:
        type === "delete"
          ? "Product deleted successfully"
          : `Quantity ${type}ed successfully`,
    });
  } catch (err) {
    throw new ServerException("Unable to update product", err);
  }
};
