import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { validateRequiredFields } from "../../functions/functions";

import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetProfileInfo = async (req: Request, res: Response) => {
  const { accountId } = req.params;

  // Validate required fields
  validateRequiredFields([
    {
      name: "Account Id",
      value: accountId,
    },
  ]);

  // Check if user exists
  const userExists = await prisma.logisticsProvider.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }
  const { password, ...others } = userExists;

  res.status(200).json({
    status: true,
    message: "User logged in successfully",
    user: others,
  });
};
