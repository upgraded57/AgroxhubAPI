import { PrismaClient, userType } from "@prisma/client";
import { Request, Response } from "express";
import {
  findUser,
  uploadAvatar,
  validateFieldType,
} from "../../functions/functions";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import * as dotenv from "dotenv";
import { ServerException } from "../../exceptions/server-error";
import { AllUsers } from "../../helpers/users";
import { hashSync } from "bcrypt";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const GetUser = async (req: Request, res: Response) => {
  return res.status(200).json({
    status: true,
    message: "User found successfully",
    user: req.user,
  });
};

export const EditUser = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const {
    fullName: newName,
    email: newEmail,
    phoneNumber: newPhoneNumber,
    address: newAddress,
    oldPassword,
    newPassword,
    regionId,
  } = req.body;

  const avatar = req.file;

  if (
    !newName &&
    !newEmail &&
    !newPhoneNumber &&
    !avatar &&
    !regionId &&
    !oldPassword &&
    !newPassword
  ) {
    throw new BadRequestException("Data required to edit user account");
  }

  const foundUser = await findUser("id", userId as string);
  if (!foundUser) {
    throw new NotFoundException("User not found");
  }

  if (newName) {
    validateFieldType("name", newName);
  }
  if (newEmail) {
    validateFieldType("email", newEmail);
  }

  if (newPhoneNumber) {
    validateFieldType("phone", newPhoneNumber);
  }

  if (newPassword) {
    validateFieldType("password", newPassword);
  }

  let avatarPath: string | null = null;
  if (avatar) {
    if (avatar.size > 2 * 1024 * 1024) {
      throw new BadRequestException("Avatar cannot exceed 2MB");
    }

    avatarPath = await uploadAvatar(avatar.path);
  }

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: newName || foundUser.name,
        email: newEmail || foundUser.email,
        phoneNumber: newPhoneNumber || foundUser.phoneNumber,
        address: newAddress || foundUser.address,
        avatar: avatarPath || foundUser.avatar,
        regionId: regionId || foundUser.regionId,
      },
    });

    const { password, ...others } = updatedUser;

    return res.status(200).json({
      status: true,
      message: "User data updated successfully",
      user: others,
    });
  } catch (error) {
    throw new ServerException("Unable to update user account", error);
  }
};

export const GetAllUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  return res.status(200).json({ users });
};

export const CreateUsers = async (req: Request, res: Response) => {
  const regions = await prisma.region.findMany();

  const newUsers = AllUsers.map(async (item) => {
    const randomRegionId = Math.floor(Math.random() * regions.length);
    const randomRegion = regions[randomRegionId];
    try {
      await prisma.user.create({
        data: {
          name: item.name,
          email: item.name.toLowerCase().split(" ").join("_") + "@agroxhub.com",
          isActive: true,
          type: item.type as userType,
          password: hashSync("Payboi10", 10),
          region: {
            connect: {
              id: randomRegion.id,
            },
          },
          address: item.address,
          avatar: item.avatar,
          coverImg: item.coverImg,
          phoneNumber: item.phoneNumber,
        },
      });
    } catch (error) {
      console.log("Error", error);
    }
  });

  await Promise.all(newUsers);

  return res.status(200).json({ newUsers });
};
