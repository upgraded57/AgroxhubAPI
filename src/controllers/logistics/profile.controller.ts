import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import {
  uploadAvatar,
  validateFieldType,
  validateRequiredFields,
} from "../../functions/functions";
import { BadRequestException } from "../../exceptions/bad-request";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetProfileInfo = async (req: Request, res: Response) => {
  const userId = req.userId;

  // Check if user exists
  const userExists = await prisma.logisticsProvider.findUnique({
    where: {
      id: userId,
    },
    include: {
      region: true,
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

export const UpdateAvatar = async (req: Request, res: Response) => {
  const userId = req.userId;
  const avatar = req.file;
  if (!avatar) {
    throw new BadRequestException("New Avatar field is required");
  }

  let avatarPath: string | null = null;
  if (avatar) {
    if (avatar.size > 2 * 1024 * 1024) {
      throw new BadRequestException("Avatar cannot exceed 2MB");
    }

    avatarPath = await uploadAvatar(avatar.path);
  }

  await prisma.logisticsProvider.update({
    where: {
      id: userId,
    },
    data: {
      avatar: avatarPath,
    },
  });

  return res.status(200).json({
    status: true,
    message: "User avatar updated successfully",
  });
};

export const UpdateProfile = async (req: Request, res: Response) => {
  const userId = req.userId;
  const { email, name, contact, regionId, address } = req.body as {
    email?: string;
    name?: string;
    contact?: string;
    regionId?: string;
    address?: string;
  };

  if (!email && !name && !contact && !regionId && !address) {
    throw new BadRequestException("Please provide profile data to update");
  }

  email && validateFieldType("email", email);

  name && validateFieldType("name", name);

  contact && validateFieldType("phone", contact);

  // Ensure valid region id is provided
  if (regionId) {
    const isValidRegionId = await prisma.region.findUnique({
      where: { id: regionId },
      select: {
        id: true,
      },
    });

    if (!isValidRegionId) {
      throw new BadRequestException("Unknown region provided");
    }
  }

  // Update user
  await prisma.logisticsProvider.update({
    where: {
      id: userId!,
    },
    data: {
      name: name ? name : undefined,
      email: email ? email : undefined,
      contact: contact ? contact : undefined,
      address: address ? address : undefined,
      regionId: regionId ? regionId : undefined,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Profile information updated successfully",
  });
};

export const UpdateProfileVisibilityStatus = async (
  req: Request,
  res: Response
) => {
  const userId = req.userId;

  const user = await prisma.logisticsProvider.findUnique({
    where: {
      id: userId!,
    },
    select: {
      isVisible: true,
    },
  });

  await prisma.logisticsProvider.update({
    where: {
      id: userId!,
    },
    data: {
      isVisible: !user?.isVisible,
    },
  });

  return res.status(200).json({
    status: true,
    message: "User visibility status updated successfully",
  });
};
