import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetRegions = async (req: Request, res: Response) => {
  // const newRegs = AllRegions.map(async (item) => {
  //   try {
  //     await prisma.region.create({
  //       data: {
  //         ...item,
  //       },
  //     });
  //   } catch (error) {
  //     console.log("Error", error);
  //   }
  // });

  // await Promise.all(newRegs);

  const regions = await prisma.region.findMany({
    orderBy: {
      lcda: "asc",
    },
  });
  return res.status(200).json({
    status: true,
    message: "Regions found successfully",
    regions,
  });
};
