import {
  NotificationType,
  Prisma,
  PrismaClient,
  Product,
  userType,
} from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import {
  uploadProductImages,
  validateRequiredFields,
} from "../../functions/functions";
import apicache from "apicache";
import { AllProducts } from "../../helpers/products";
import { AllImages } from "../../helpers/images";
import { AllCategories } from "../../helpers/tags";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetAllCateories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: {
      products: {
        _count: "desc",
      },
    },
  });

  return res.status(200).json({
    status: true,
    message: "Product categories found successfully",
    categories,
  });
};

export const CreateCategories = async (req: Request, res: Response) => {
  const createdCategories = await prisma.category.createMany({
    data: AllCategories.map((c) => ({
      ...c,
      slug: c.name.split(" ").join("_").toLowerCase(),
    })),
  });

  return res.status(200).json({ createdCategories });
};

export const CreateProduct = async (req: Request, res: Response) => {
  const {
    name,
    categoryId,
    description,
    unit,
    quantity,
    sellerId,
    location,
    regionId,
    unitWeight,
    expiryDate,
    unitPrice,
  } = req.body;

  const images = req.files as Express.Multer.File[];

  validateRequiredFields([
    {
      name: "Product Name",
      value: name,
    },
    {
      name: "Product Category",
      value: categoryId,
    },
    {
      name: "Product Description",
      value: description,
    },
    {
      name: "Product Available Quantity",
      value: quantity,
    },

    {
      name: "Product Seller",
      value: sellerId,
    },
    {
      name: "Product Location",
      value: location,
    },
    {
      name: "Product Region",
      value: regionId,
    },
    {
      name: "Product Unit Weight",
      value: unitWeight,
    },
    {
      name: "Product Unit Price",
      value: unitPrice,
    },
  ]);

  let imgUrls: string[] = [];

  if (images && images.length > 0) {
    imgUrls = await uploadProductImages(images);
  }

  const newProduct = await prisma.product.create({
    data: {
      seller: {
        connect: {
          id: sellerId,
        },
      },
      region: {
        connect: {
          id: regionId,
        },
      },
      category: {
        connect: {
          id: categoryId,
        },
      },
      location,
      name,
      quantity: parseInt(quantity),
      unitWeight,
      unit,
      unitPrice: parseInt(unitPrice),
      description,
      expiryDate: expiryDate ?? null,
      images: [...imgUrls],
      slug:
        name.toLowerCase().split(" ").join("_") +
        "_" +
        Math.floor(Math.random() * 200000).toString(),
    },
  });

  return res.status(201).json({
    status: true,
    message: "Product created successfully",
    product: newProduct,
  });
};

export const GetAllProducts = async (req: Request, res: Response) => {
  const {
    currentPage = 0,
    q,
    minPrice,
    maxPrice,
    region,
    rating,
    seller,
    category,
  } = req.query;

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

    seller:
      seller && typeof seller === "string"
        ? { type: seller as userType }
        : undefined,

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

    region:
      region && typeof region === "string"
        ? {
            name: { contains: region, mode: "insensitive" },
          }
        : undefined,

    ratings:
      rating && typeof rating === "string" ? parseInt(rating) : undefined,
  };

  // Fetch the filtered products
  const products = await prisma.product.findMany({
    where: whereCondition, // Apply filters
    take: perPage,
    skip: skipCount,
    orderBy: { createdAt: "desc" },
  });

  // Get total count of filtered products
  const totalProducts = await prisma.product.count({
    where: whereCondition, // Apply the same filters
  });

  // Check if there are more products
  const hasMore = skipCount + products.length < totalProducts;

  if (!products.length) throw new NotFoundException("No product found.");

  res.json({
    status: true,
    message: "Products found successfully",
    products,
    hasMore,
    total: totalProducts,
  });
};

export const getRecentProducts = async (req: Request, res: Response) => {
  let { slugs } = req.query;

  slugs = JSON.parse(slugs as string) as string[];

  if (!slugs || slugs.length < 1) {
    throw new BadRequestException("Product slugs are required");
  }

  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: slugs,
      },
    },
    take: 6,
  });

  return res.status(200).json({
    status: true,
    message: "Products found successfully",
    products,
  });
};

export const GetSingleProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;

  validateRequiredFields([{ name: "Product Slug", value: slug }]);

  // Find and update the product in one query
  const product = await prisma.product.update({
    where: { slug },
    data: {
      clicks: { increment: 1 },
      views: { increment: 1 },
    },
    include: {
      reviews: {
        include: { user: true },
      },
      seller: true,
    },
  });

  if (!product) {
    throw new NotFoundException("Product not found");
  }

  // Send notification to seller when product reaches certain (e.g 10) clicks
  if (product.clicks % 10 === 0) {
    await prisma.notification.create({
      data: {
        user: {
          connect: {
            id: product.sellerId,
          },
        },
        type: NotificationType.milestone,
        subject: "New Product Milestone!",
        summary: `Your product - ${product.name} - has reached ${product.clicks} clicks. Expect orders soon!`,
        milestone: "10 Clicks",
        product: {
          connect: {
            id: product.id,
          },
        },
      },
    });
  }

  return res.status(200).json({
    status: true,
    message: "Product found successfully",
    product: {
      ...product,
      reviews: product.reviews.map((r) => ({
        rating: r.productRating,
        review: r.productReview,
        createdAt: r.createdAt,
        user: {
          id: r.user.id,
          name: r.user.name,
          avatar: r.user.avatar,
        },
      })),
    },
  });
};

export const GetSimilarProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;

  validateRequiredFields([
    {
      name: "Product Slug",
      value: slug,
    },
  ]);

  const foundProduct = await prisma.product.findFirst({
    where: { slug },
    select: { categoryId: true },
  });

  let similarProducts: Product[];

  if (!foundProduct) {
    similarProducts = await prisma.product.findMany({
      take: 4,
    });
  } else {
    similarProducts = await prisma.product.findMany({
      where: {
        slug: { not: slug },
        categoryId: foundProduct.categoryId,
      },
      take: 4,
    });
  }

  return res.status(200).json({
    status: true,
    message: "Similar products found successfully",
    products: similarProducts,
  });
};

export const DeleteProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = req.user;
  const cache = apicache.getIndex();
  const allCache = cache.all;
  // console.log(allCache);

  validateRequiredFields([
    {
      name: "Product Slug",
      value: slug,
    },
  ]);

  const product = await prisma.product.findFirst({
    where: {
      slug,
    },
    select: {
      id: true,
      sellerId: true,
    },
  });

  if (!product) {
    throw new NotFoundException("Product not found!");
  }

  if (product.sellerId !== user?.id) {
    throw new UnauthorizedException("This action is unauthorized!");
  }

  await prisma.product.delete({
    where: {
      id: product.id,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Product deleted successfully",
  });
};

export const EditProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;
  // const {name, }
  const user = req.user;
  validateRequiredFields([
    {
      name: "Product slug",
      value: slug,
    },
  ]);

  const product = await prisma.product.findUnique({
    where: {
      slug,
    },
  });

  if (!product) {
    throw new NotFoundException("Product not found");
  }

  // Check if user owns product
  if (user?.id !== product.sellerId) {
    throw new UnauthorizedException("Cannot edit another seller product");
  }
};

export const createTempProducts = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  const sellers = users.filter((item) => item.type !== "buyer");
  const categories = await prisma.category.findMany();
  const newPs = AllProducts.map(async (item) => {
    try {
      const ranNum1 = Math.floor(Math.random() * AllImages.length);
      const ranNum2 = Math.floor(Math.random() * AllImages.length);
      const ranNum3 = Math.floor(Math.random() * AllImages.length);
      const ranNum4 = Math.floor(Math.random() * AllImages.length);
      const randomSeller = sellers[Math.floor(Math.random() * sellers.length)];
      const randomCategory =
        categories[Math.floor(Math.random() * sellers.length)];
      await prisma.product.create({
        data: {
          name: item.name + "_" + Math.floor(Math.random() * 1000).toString(),
          seller: {
            connect: {
              id: randomSeller.id,
            },
          },
          slug:
            item.name.toLowerCase().split(" ").join("_") +
            "_" +
            Math.floor(Math.random() * 200000).toString(),
          unitPrice: Math.random() * 5000,
          region: {
            connect: {
              id: randomSeller.regionId ?? "cme8ixzgy0000wqs6bclsxnyb",
            },
          },
          category: {
            connect: {
              id: randomCategory.id,
            },
          },
          unitWeight: item.unitWeight,
          unit: item.unit,
          quantity: item.quantity,
          description: item.description,
          location: item.location,
          images: [
            AllImages[ranNum1].download_url,
            AllImages[ranNum2].download_url,
            AllImages[ranNum3].download_url,
            AllImages[ranNum4].download_url,
          ],
          ratings: parseInt((Math.random() * 5).toFixed(1)),
        },
      });
    } catch (error) {
      // console.log("Error", error);
    }
  });

  await Promise.all(newPs);

  return res.status(200).json({ products: newPs });
};
