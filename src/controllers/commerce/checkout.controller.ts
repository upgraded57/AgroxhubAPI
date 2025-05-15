import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import {
  generateOrderNumber,
  validateRequiredFields,
} from "../../functions/functions";
import { ServerException } from "../../exceptions/server-error";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { ForbiddenException } from "../../exceptions/forbidden";

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

  if (!regionExists) {
    throw new BadRequestException("Supplied region does not exist!");
  }

  // Get all products from cart
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      cartItems: {
        select: {
          id: true,
          quantity: true,
          product: {
            select: {
              id: true,
              unitPrice: true,
              sellerId: true,
              regionId: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.cartItems.length < 1) {
    throw new BadRequestException("Cart is empty or cannot be processed");
  }

  // Group products by sellerId
  const groupedProducts = cart.cartItems.reduce((acc, cartItem) => {
    const { id: productId, unitPrice, sellerId, regionId } = cartItem.product;
    const group = acc[sellerId] || [];

    group.push({
      productId,
      quantity: cartItem.quantity,
      unitPrice,
      totalPrice: cartItem.quantity * unitPrice,
      regionId: regionId || "",
    });

    acc[sellerId] = group;
    return acc;
  }, {} as Record<string, { productId: string; quantity: number; unitPrice: number; totalPrice: number; regionId: string }[]>);

  // Calculate total amount
  const productsAmount = Object.values(groupedProducts)
    .flat()
    .reduce((sum, item) => sum + item.totalPrice, 0);

  // Delete any pending user unpaid order
  await prisma.order.deleteMany({
    where: {
      userId: user?.id,
      paymentStatus: "pending",
      status: "pending",
    },
  });

  // Step 1: Create the Order (without orderGroups)
  const orderNumber = generateOrderNumber(user!);

  const order = await prisma.order.create({
    data: {
      user: { connect: { id: user?.id } },
      deliveryAddress,
      deliveryRegion: { connect: { id: deliveryRegionId } },
      productsAmount,
      orderNumber,
    },
  });

  const orderCompletionCode = Math.random() * 100000;
  // Step 2: Update the Order to add Order Groups & Order Items
  const createdOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      orderGroups: {
        create: Object.entries(groupedProducts).map(([sellerId, items]) => ({
          seller: { connect: { id: sellerId } },
          orderCompletionCode,
          // Logistic provider will be appended here

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
    include: {
      orderGroups: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          seller: { select: { regionId: true } },
          logisticsProvider: true,
        },
      },
    },
  });

  const allProviderRegions = await prisma.logisticsProviderRegion.findMany({
    where: {
      regionId: {
        in: [
          ...createdOrder.orderGroups.map((group) => group.seller.regionId!),
          deliveryRegionId,
        ],
      },
    },
  });

  // Build maps
  const regionToProvidersMap = allProviderRegions.reduce((acc, item) => {
    if (!acc[item.regionId]) acc[item.regionId] = [];
    acc[item.regionId].push(item.logisticsProviderId);
    return acc;
  }, {} as Record<string, string[]>);

  // Assign logistics provider
  await Promise.all(
    createdOrder.orderGroups.map(async (group) => {
      const productRegionId = group.seller.regionId!;
      const productsCategoryIds = group.orderItems.map(
        (item) => item.product.categoryId
      );

      const pickupRegionProviders = regionToProvidersMap[productRegionId] || [];
      const deliveryRegionProviders =
        regionToProvidersMap[deliveryRegionId] || [];

      const eligibleProviders = pickupRegionProviders.filter((id) =>
        deliveryRegionProviders.includes(id)
      );

      if (eligibleProviders.length === 0) return;

      // Fetch provider-category-unitCost mapping
      const providerCategoryMatches =
        await prisma.logisticsProviderCategory.findMany({
          where: {
            logisticsProviderId: {
              in: eligibleProviders,
            },
            categoryId: {
              in: productsCategoryIds,
            },
          },
        });

      // Build a map like: { [providerId]: Set of categoryIds it supports }
      const providerSupportMap = providerCategoryMatches.reduce((acc, item) => {
        if (!acc[item.logisticsProviderId]) {
          acc[item.logisticsProviderId] = new Set();
        }
        acc[item.logisticsProviderId].add(item.categoryId);
        return acc;
      }, {} as Record<string, Set<string>>);

      // Filter only providers who support ALL product categories
      const fullyEligibleProviders = Object.entries(providerSupportMap)
        .filter(([_, categories]) =>
          productsCategoryIds.every((catId) => categories.has(catId))
        )
        .map(([providerId]) => providerId);

      if (fullyEligibleProviders.length === 0) return;

      // Choose first eligible provider
      const selectedProviderId = fullyEligibleProviders[0];

      // Now calculate total logistics cost for this group
      const logisticsPricingMap = providerCategoryMatches
        .filter((p) => p.logisticsProviderId === selectedProviderId)
        .reduce((acc, curr) => {
          acc[curr.categoryId] = curr.unitCost;
          return acc;
        }, {} as Record<string, number>);

      let totalLogisticsCost = 0;
      for (const item of group.orderItems) {
        const categoryId = item.product.categoryId;
        const unitCost = logisticsPricingMap[categoryId] || 0;
        totalLogisticsCost += unitCost * item.quantity;
      }

      // Update OrderGroup with provider and cost
      await prisma.orderGroup.update({
        where: { id: group.id },
        data: {
          logisticsProviderId: selectedProviderId,
          logisticsCost: totalLogisticsCost,
        },
      });
    })
  );

  // Update total logistics costs for order
  const orderGroups = await prisma.order.findUnique({
    where: {
      id: order.id,
    },
    select: {
      orderGroups: {
        select: {
          logisticsCost: true,
          orderItems: {
            select: {
              totalPrice: true,
            },
          },
        },
      },
    },
  });

  let totalAmountWithoutVat = 0;
  let totalLogisticsAmount = 0;
  orderGroups?.orderGroups.map((group) => {
    totalAmountWithoutVat += group.logisticsCost || 0;
    totalLogisticsAmount += group.logisticsCost || 0;

    // add total products price
    group.orderItems.map((item) => {
      totalAmountWithoutVat += item.totalPrice;
    });
  });

  const vat = 0.1 * totalAmountWithoutVat;

  // Update order total amount
  await prisma.order.update({
    where: { id: order.id },
    data: {
      totalAmount: totalAmountWithoutVat + vat,
      vat,
      logisticsAmount: totalLogisticsAmount,
    },
  });

  return res
    .status(201)
    .json({ status: true, message: "Order created successfully", order });
};

export const GetSingleOrder = async (req: Request, res: Response) => {
  const user = req.user!;
  const { orderNumber } = req.params;

  validateRequiredFields([
    {
      name: "Order Number",
      value: orderNumber,
    },
  ]);

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      userId: user?.id,
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
          logisticsProvider: true,
          orderItems: {
            select: {
              id: true,
              product: {
                select: {
                  slug: true,
                  images: true,
                  name: true,
                  unit: true,
                  ratings: true,
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

  if (!order) {
    throw new NotFoundException("Order not found!");
  }

  // Check if order's payment has been settled
  if (order.paymentStatus !== "pending") {
    throw new ForbiddenException("Order's payment already fulfilled!");
  }

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
        logisticProvider: item.logisticsProvider,
        logisticsCost: item.logisticsCost,
        orderItems: item.orderItems.map((entity) => ({
          id: entity.id,
          slug: entity.product.slug,
          image: entity.product.images[0],
          name: entity.product.name,
          ratings: entity.product.ratings,
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

export const GetOrderLogisticsProviders = async (
  req: Request,
  res: Response
) => {
  const { groupId } = req.params;

  validateRequiredFields([
    {
      name: "Group Id",
      value: groupId,
    },
  ]);

  const group = await prisma.orderGroup.findUnique({
    where: {
      id: groupId,
    },
    include: {
      seller: {
        select: {
          regionId: true,
        },
      },
      orderItems: {
        include: {
          product: true,
        },
      },
      order: {
        select: {
          deliveryRegionId: true,
        },
      },
    },
  });

  if (!group) {
    throw new NotFoundException("Order group not found");
  }

  if (group.seller.regionId === null) {
    throw new BadRequestException("Cannot determine product region");
  }

  const allProviderRegions = await prisma.logisticsProviderRegion.findMany({
    where: {
      regionId: {
        in: [group.seller.regionId, group.order.deliveryRegionId],
      },
    },
  });

  // Build maps
  const regionToProvidersMap = allProviderRegions.reduce((acc, item) => {
    if (!acc[item.regionId]) acc[item.regionId] = [];
    acc[item.regionId].push(item.logisticsProviderId);
    return acc;
  }, {} as Record<string, string[]>);

  // Assign logistics provider
  const productRegionId = group.seller.regionId!;
  const productsCategoryIds = group.orderItems.map(
    (item) => item.product.categoryId
  );

  const pickupRegionProviders = regionToProvidersMap[productRegionId] || [];
  const deliveryRegionProviders =
    regionToProvidersMap[group.order.deliveryRegionId] || [];

  const eligibleProviders = pickupRegionProviders.filter((id) =>
    deliveryRegionProviders.includes(id)
  );

  if (eligibleProviders.length === 0) {
    throw new NotFoundException("No logistic provider for this route");
  }

  // Fetch provider-category-unitCost mapping
  const providerCategoryMatches =
    await prisma.logisticsProviderCategory.findMany({
      where: {
        logisticsProviderId: {
          in: eligibleProviders,
        },
        categoryId: {
          in: productsCategoryIds,
        },
      },
    });

  // Build a map like: { [providerId]: Set of categoryIds it supports }
  const providerSupportMap = providerCategoryMatches.reduce((acc, item) => {
    if (!acc[item.logisticsProviderId]) {
      acc[item.logisticsProviderId] = new Set();
    }
    acc[item.logisticsProviderId].add(item.categoryId);
    return acc;
  }, {} as Record<string, Set<string>>);

  // Filter only providers who support ALL product categories
  const fullyEligibleProviders = Object.entries(providerSupportMap)
    .filter(([_, categories]) =>
      productsCategoryIds.every((catId) => categories.has(catId))
    )
    .map(([providerId]) => providerId);

  if (fullyEligibleProviders.length === 0) {
    throw new NotFoundException("No logistics provider found for this order");
  }

  // Now calculate total logistics cost for this group
  const totalCost = fullyEligibleProviders.map((providerId) => {
    const logisticsPricingMap = providerCategoryMatches
      .filter((p) => p.logisticsProviderId === providerId)
      .reduce((acc, curr) => {
        acc[curr.categoryId] = curr.unitCost;
        return acc;
      }, {} as Record<string, number>);

    let totalLogisticsCost = 0;
    for (const item of group.orderItems) {
      const categoryId = item.product.categoryId;
      const unitCost = logisticsPricingMap[categoryId] || 0;
      totalLogisticsCost += unitCost * item.quantity;
    }
    return { providerId, totalLogisticsCost };
  });

  const providers = await prisma.logisticsProvider.findMany({
    where: {
      id: {
        in: fullyEligibleProviders,
      },
    },
    omit: {
      password: true,
    },
  });

  return res.status(200).json({
    status: true,
    message: "logistics providers found successfully",
    providers: providers.map((provider) => {
      const providerCost = totalCost.find(
        (el) => el.providerId === provider.id
      );

      return {
        ...provider,
        logisticCost: providerCost?.totalLogisticsCost,
      };
    }),
  });
};
