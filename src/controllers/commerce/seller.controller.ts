import { Prisma, PrismaClient, userType } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../../functions/functions";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { ServerException } from "../../exceptions/server-error";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

const getFollowers = async (sellerId: string) => {
  try {
    const followers = await prisma.following.findMany({
      where: {
        followingId: sellerId,
      },
      select: {
        createdAt: true,
        follower: {
          select: {
            name: true,
            id: true,
            avatar: true,
          },
        },
      },
    });

    return followers;
  } catch (error) {
    throw new ServerException("Unable to fetch seller followers", error);
  }
};

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

export const GetSellerFollowers = async (req: Request, res: Response) => {
  const sellerId = req.user?.id;

  validateRequiredFields([
    {
      name: "Seller Id",
      value: sellerId!,
    },
  ]);

  const followers = await getFollowers(sellerId!);

  res.status(200).json({
    status: true,
    message: "Followers found successfully",
    followers: followers?.map((item) => ({
      name: item.follower.name,
      id: item.follower.id,
      createdAt: item.createdAt,
      avatar: item.follower.avatar,
    })),
  });
};

export const FollowSeller = async (req: Request, res: Response) => {
  const user = req.user;
  const { sellerId } = req.params;

  validateRequiredFields([{ name: "Seller Id", value: sellerId }]);
  const isSeller = user?.type === "wholesaler" || user?.type === "farmer";
  if (isSeller) {
    throw new UnauthorizedException("Only buyers can follow sellers");
  }

  // Check if the user is already following the seller
  const existingFollow = await prisma.following.findFirst({
    where: {
      followerId: user!.id,
      followingId: sellerId,
    },
  });

  if (existingFollow) {
    // Unfollow the seller
    await prisma.following.deleteMany({
      where: {
        followerId: user!.id,
        followingId: sellerId,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Seller unfollowed successfully",
    });
  }

  // Follow the seller
  const follow = await prisma.following.create({
    data: {
      followerId: user!.id,
      followingId: sellerId,
    },
  });

  // Create notification of follow to seller
  await prisma.notification.create({
    data: {
      user: {
        connect: {
          id: sellerId,
        },
      },
      subject: "You have a new follower",
      type: "follow",
      summary: `${user!.name} just followed you. You're gaining traction!`,
      follower: {
        connect: {
          id: follow.id,
        },
      },
    },
  });

  return res.status(200).json({
    status: true,
    message: "Seller followed successfully",
  });
};

export const CheckIsFollowing = async (req: Request, res: Response) => {
  const { sellerId } = req.params;
  const user = req.user;

  validateRequiredFields([{ name: "Seller Id", value: sellerId }]);

  // Check if the user is already following the seller
  const existingFollow = await prisma.following.findFirst({
    where: {
      followerId: user!.id,
      followingId: sellerId,
    },
  });

  res.status(200).json({
    status: true,
    message: "Check successful",
    isFollowing: existingFollow ? true : false,
  });
};

export const GetSellerSummary = async (req: Request, res: Response) => {
  const sellerId = req.user?.id!;

  validateRequiredFields([{ name: "Seller Id", value: sellerId }]);

  const followers = await getFollowers(sellerId);
  const products = await prisma.product.findMany({
    where: {
      sellerId,
    },
    select: {
      id: true,
    },
  });

  const sellerProducts = await prisma.orderItem.findMany({
    where: {
      product: {
        sellerId,
      },
    },
    include: {
      orderGroup: {
        select: {
          status: true,
        },
      },
    },
  });

  let totalProductsPrice = 0;
  sellerProducts.forEach((item) => {
    totalProductsPrice += item.totalPrice;
  });

  const summary = {
    products: products.length,
    followers: followers.length,
    deliveredProducts:
      sellerProducts.filter((p) => p.orderGroup.status === "delivered")
        .length || 0,
    orderedProducts: sellerProducts.length || 0,
    rejectedProducts:
      sellerProducts.filter((p) => p.orderGroup.status === "rejected").length ||
      0,
    inTransitProducts:
      sellerProducts.filter((p) => p.orderGroup.status === "in_transit")
        .length || 0,
    cartProducts:
      sellerProducts.filter((p) => p.orderGroup.status === "pending").length ||
      0,
    totalEarnings: totalProductsPrice,
  };

  return res.status(200).json({
    status: true,
    message: "Seller summary found successfully",
    summary,
  });
};

export const GetSellerOrders = async (req: Request, res: Response) => {
  const user = req.user;
  const orders = await prisma.orderGroup.findMany({
    where: {
      sellerId: user!.id,
    },
    include: {
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json({
    status: true,
    message: "Orders found successfully",
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
      productsCount: order._count.orderItems,
    })),
  });
};

export const GetSellerSingleOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.orderGroup.findUnique({
    where: {
      id: orderId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
      seller: true,
      order: {
        include: {
          user: true,
        },
      },
      logisticsProvider: {
        select: {
          name: true,
          avatar: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  res.status(200).json({
    status: true,
    message: "Orders found successfully",
    order: {
      id: order.id,
      pickupAddress: order.seller.address,
      deliveryAddress: order.order.deliveryAddress,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
      status: order.status,
      createdAt: order.createdAt,
      user: {
        name: order.order.user.name,
        avatar: order.order.user.avatar,
      },
      logisticsProvider: {
        name: order.logisticsProvider?.name,
        avatar: order.logisticsProvider?.avatar,
      },
      products: order.orderItems.map((el) => ({
        slug: el.product.slug,
        name: el.product.name,
        quantity: el.quantity,
        unit: el.product.unit,
        images: el.product.images,
      })),
    },
  });
};
