import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import * as dotenv from "dotenv";
import { UnauthorizedException } from "../exceptions/unauthorized";
import { ForbiddenException } from "../exceptions/forbidden";
import { ServerException } from "../exceptions/server-error";
import {
  uploadProductImages,
  validateRequiredFields,
} from "../functions/functions";
import { AllProducts } from "../helpers/products";
import { AllCategories } from "../helpers/tags";
import { AllImages } from "../helpers/images";
import apicache from "apicache";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetAllCateories = async (req: Request, res: Response) => {
  // const AllCats = AllCategories.map(async (item) => {
  //   try {
  //     await prisma.category.create({
  //       data: {
  //         ...item,
  //         slug: item.name.toLowerCase().split(" ").join("_"),
  //       },
  //     });
  //   } catch (error) {
  //     console.log("Error", error);
  //   }
  // });

  // await Promise.all(AllCats);

  const categories = await prisma.category.findMany();

  return res.status(200).json({
    status: true,
    message: "Product categories found successfully",
    categories,
  });
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
  // const createTempProducts = async () => {
  //   const users = await prisma.user.findMany();
  //   const sellers = users.filter((item) => item.type !== "buyer");
  //   const categories = await prisma.category.findMany();
  //   const newPs = AllProducts.map(async (item) => {
  //     try {
  //       const ranNum1 = Math.floor(Math.random() * AllImages.length);
  //       const ranNum2 = Math.floor(Math.random() * AllImages.length);
  //       const ranNum3 = Math.floor(Math.random() * AllImages.length);
  //       const ranNum4 = Math.floor(Math.random() * AllImages.length);
  //       const randomSeller =
  //         sellers[Math.floor(Math.random() * sellers.length)];
  //       const randomCategory =
  //         categories[Math.floor(Math.random() * sellers.length)];
  //       await prisma.product.create({
  //         data: {
  //           name: item.name + "_" + Math.floor(Math.random() * 1000).toString(),
  //           seller: {
  //             connect: {
  //               id: randomSeller.id,
  //             },
  //           },
  //           slug:
  //             item.name.toLowerCase().split(" ").join("_") +
  //             "_" +
  //             Math.floor(Math.random() * 200000).toString(),
  //           unitPrice: Math.random() * 5000,
  //           region: {
  //             connect: {
  //               id:
  //                 randomSeller.regionId ??
  //                 "0231e8e3-7296-42e5-ae9b-1baeec059e70",
  //             },
  //           },
  //           category: {
  //             connect: {
  //               id: randomCategory.id,
  //             },
  //           },
  //           unitWeight: item.unitWeight,
  //           unit: item.unit,
  //           quantity: item.quantity,
  //           description: item.description,
  //           location: item.location,
  //           images: [
  //             AllImages[ranNum1].download_url,
  //             AllImages[ranNum2].download_url,
  //             AllImages[ranNum3].download_url,
  //             AllImages[ranNum4].download_url,
  //           ],
  //           ratings: parseInt((Math.random() * 5).toFixed(1)),
  //         },
  //       });
  //     } catch (error) {
  //       console.log("Error", error);
  //     }
  //   });

  //   await Promise.all(newPs);
  // };

  const {
    currentPage = 0,
    perPage = 30,
    q,
    minPrice,
    maxPrice,
    region,
    rating,
    category,
  } = req.query;

  const skipCount =
    parseInt(currentPage as string) * parseInt(perPage as string);

  const products = await prisma.product.findMany({
    where: {
      // Search by name (case-insensitive)
      name: q ? { contains: q as string, mode: "insensitive" } : undefined,

      // Filter by category (if provided)
      category: category ? { slug: category as string } : undefined,

      // Filter by price range (if either minPrice or maxPrice is provided)
      unitPrice:
        minPrice || maxPrice
          ? {
              gte: minPrice ? parseInt(minPrice as string) : undefined,
              lte: maxPrice ? parseInt(maxPrice as string) : undefined,
            }
          : undefined,

      // Filter by region (if provided)
      region: region
        ? {
            name: {
              contains: region as string,
              mode: "insensitive",
            },
          }
        : undefined,

      // Filter by rating (if provided)
      ratings: rating ? parseInt(rating as string) : undefined,
    },
    take: parseInt(perPage as string), // Number of items to fetch
    skip: skipCount, // Offset for pagination
    orderBy: { createdAt: "desc" }, // Order by the newest first
  });

  // Check if there are more products
  const totalProducts = await prisma.product.count(); // Total number of products in the database
  const hasMore = skipCount + products.length < totalProducts;

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
  });

  return res.status(200).json({
    status: true,
    message: "Products found successfully",
    products,
  });
};

export const GetSingleProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;
  validateRequiredFields([
    {
      name: "Produc Slug",
      value: slug,
    },
  ]);

  const product = await prisma.product.findFirst({
    where: {
      slug,
    },
    include: {
      reviews: true,
      seller: true,
    },
  });

  if (!product) {
    throw new NotFoundException("Product not found!");
  }

  return res.status(200).json({
    status: true,
    message: "Product found successfully",
    product,
  });
};

export const GetSimilarProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;
  validateRequiredFields([
    {
      name: "Produc Slug",
      value: slug,
    },
  ]);

  const foundProduct = await prisma.product.findFirst({
    where: {
      slug,
    },
    select: {
      categoryId: true,
    },
  });

  if (!foundProduct) {
    throw new NotFoundException("Product not found!");
  }

  // Fetch similar products
  const similarProducts = await prisma.product.findMany({
    where: {
      slug: {
        not: slug,
      },
      categoryId: foundProduct.categoryId,
    },
  });

  if (!similarProducts) {
    throw new NotFoundException("No similar product");
  }

  return res.status(200).json({
    status: true,
    message: "Smiliar products found successfully",
    products: similarProducts,
  });
};

export const DeleteProduct = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const user = req.user;
  const cache = apicache.getIndex();
  const allCache = cache.all;
  console.log(allCache);

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
