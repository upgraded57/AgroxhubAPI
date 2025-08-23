import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import {
  createOtp,
  findUser,
  sendOtp,
  validateFieldType,
  validateRequiredFields,
} from "../../functions/functions";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { ForbiddenException } from "../../exceptions/forbidden";
import { ServerException } from "../../exceptions/server-error";
dotenv.config({ path: "./.env" });

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const Login = async (req: Request, res: Response) => {
  if (!req.body) {
    throw new BadRequestException("Request Payload Required!");
  }

  const { email, password } = req.body;
  // Validate required fields
  validateRequiredFields([
    {
      name: "Email Address",
      value: email,
    },
    {
      name: "Password",
      value: password,
    },
  ]);

  // Check values format
  validateFieldType("email", email);

  validateFieldType("password", password);

  // Check if user exists
  const userExists = await findUser("email", email);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  // Check password
  const passwordCorrect = bcrypt.compareSync(password, userExists.password);
  if (!passwordCorrect) {
    throw new BadRequestException("Incorrect login credentials");
  }

  // Check if user account is active
  if (!userExists.isActive) {
    // Create otp
    const userOtp = await createOtp(userExists.id);

    // Send otp to user
    sendOtp(userOtp, "create", userExists.email);
    return res.status(401).json({
      status: false,
      message: "User account not active",
      userId: userExists.id,
    });
  }

  const token = jwt.sign(
    {
      userId: userExists.id,
    },
    process.env.JWT_KEY!,
    { expiresIn: "24h" }
  );

  res.status(200).json({
    status: true,
    message: "User logged in successfully",
    user: {
      type: userExists.type,
      id: userExists.id,
    },
    token,
  });
};

export const Signup = async (req: Request, res: Response) => {
  const { fullName, email, password, type } = req.body;

  validateRequiredFields([
    {
      name: "Full Name",
      value: fullName,
    },
    {
      name: "Email Address",
      value: email,
    },
    {
      name: "Password",
      value: password,
    },
    {
      name: "Account Type",
      value: type,
    },
  ]);

  // Validate fields values
  validateFieldType("name", fullName.trim());
  validateFieldType("email", email);
  validateFieldType("password", password);

  // Check if user already exists
  const userExists = await findUser("email", email);
  if (userExists) {
    throw new ForbiddenException("User with same email already exists");
  }

  // Encrypt password
  const encryptedPassword = bcrypt.hashSync(password, 10);

  // Create user
  try {
    const newUser = await prisma.user.create({
      data: {
        name: fullName.trim(),
        email,
        password: encryptedPassword,
        type,
      },
    });

    // Create otp
    const userOtp = await createOtp(newUser.id);

    // Send otp to user
    sendOtp(userOtp, "create", newUser.email);

    // Send response to user
    res.status(201).json({
      status: true,
      message: "User account created successfully",
      userId: newUser.id,
    });
  } catch (error) {
    throw new ServerException("Unable to create user", error);
  }
};

export const VerifyOtp = async (req: Request, res: Response) => {
  const { userId, otp } = req.body;

  validateRequiredFields([
    {
      name: "User Id",
      value: userId,
    },
    {
      name: "Otp",
      value: otp,
    },
  ]);

  validateFieldType("otp", otp);

  const userExists = await findUser("id", userId);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  if (userExists.isActive) {
    throw new UnauthorizedException("User account already active");
  }

  let otpExists;
  try {
    // Check if otp exists
    otpExists = await prisma.otp.findFirst({
      where: {
        userId,
        otp: parseInt(otp),
      },
    });
  } catch (error) {
    throw new BadRequestException("Invalid otp supplied");
  }

  if (otpExists?.used) {
    throw new BadRequestException("Otp has been blacklisted");
  }

  // Activate user account
  try {
    const activatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        isActive: true,
      },
    });

    const { password, ...others } = activatedUser;

    res.status(200).json({
      status: true,
      message: "User account activated successfully",
      user: others,
    });
  } catch (error) {
    throw new ServerException("Unable to activate user account", error);
  }
};

export const ForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  validateRequiredFields([{ name: "Email Address", value: email }]);

  validateFieldType("email", email);

  const userExists = await findUser("email", email);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  // send reset otp
  const otp = await createOtp(userExists.id);

  sendOtp(otp, "reset", userExists.id);

  res.status(200).json({
    status: true,
    message: "Account reset otp sent successfully",
    userId: userExists.id,
  });
};

export const VerifyResetOtp = async (req: Request, res: Response) => {
  const { userId, otp } = req.body;

  validateRequiredFields([
    {
      name: "User Id",
      value: userId,
    },
    {
      name: "Otp",
      value: otp,
    },
  ]);

  validateFieldType("otp", otp);

  const userExists = await findUser("id", userId);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  let otpExists;
  try {
    // Check if otp exists
    otpExists = await prisma.otp.findFirst({
      where: {
        userId,
        otp: parseInt(otp),
      },
    });
  } catch (error) {
    throw new BadRequestException("Invalid otp supplied");
  }

  if (!otpExists) {
    throw new BadRequestException("Invalid otp supplied");
  }

  if (otpExists?.used) {
    throw new BadRequestException("Otp has been blacklisted");
  }

  //   Blacklist otp
  await prisma.otp.update({
    where: {
      id: otpExists.id,
    },
    data: {
      used: true,
    },
  });

  return res.status(200).json({
    status: true,
    message: "Otp verified successfully",
    userId: userExists.id,
  });
};

export const ResetPassword = async (req: Request, res: Response) => {
  const { userId, password } = req.body;

  validateRequiredFields([
    {
      name: "User Id",
      value: userId,
    },
    {
      name: "Password",
      value: password,
    },
  ]);

  validateFieldType("password", password);

  const userExists = await findUser("id", userId);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }
  // Encrypt password
  const encryptedPassword = bcrypt.hashSync(password, 10);

  try {
    await prisma.user.update({
      where: {
        id: userExists.id,
      },
      data: {
        password: encryptedPassword,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    throw new ServerException("Unable to reset password", error);
  }
};

export const ResendOtp = async (req: Request, res: Response) => {
  const { userId } = req.body;

  validateRequiredFields([
    {
      name: "User Id",
      value: userId,
    },
  ]);

  const userExists = await findUser("id", userId);
  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  // send reset otp
  const otp = await createOtp(userExists.id);

  sendOtp(otp, "create", userExists.email);

  res.status(200).json({
    status: true,
    message: "Otp resent successfully",
    userId: userExists.id,
  });
};
