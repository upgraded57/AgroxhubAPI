import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import {
  findUser,
  sendActivationLink,
  validateFieldType,
  validateRequiredFields,
} from "../../functions/functions";
import { BadRequestException } from "../../exceptions/bad-request";
import { NotFoundException } from "../../exceptions/not-found";
import bcrypt from "bcrypt";
import jwt, { JsonWebTokenError, JwtPayload } from "jsonwebtoken";
import * as dotenv from "dotenv";
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
  const userExists = await prisma.logisticsProvider.findUnique({
    where: {
      email,
    },
  });

  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  // Check password
  const passwordCorrect = bcrypt.compareSync(password, userExists.password);
  if (!passwordCorrect) {
    throw new BadRequestException("Incorrect login credentials");
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
    userId: userExists.id,
    token,
  });
};

export const Register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  validateRequiredFields([
    {
      name: "Company Name",
      value: name,
    },
    {
      name: "Email Address",
      value: email,
    },
    {
      name: "Password",
      value: password,
    },
  ]);

  // Validate fields values
  validateFieldType("name", name.trim());
  validateFieldType("email", email);
  validateFieldType("password", password);

  // Check if user already exists
  const userExists = await prisma.logisticsProvider.findUnique({
    where: {
      email,
    },
  });

  if (userExists) {
    throw new ForbiddenException(
      "Logistic Provider with same email already exists"
    );
  }

  // Encrypt password
  const encryptedPassword = bcrypt.hashSync(password, 10);

  // Create user
  try {
    const newUser = await prisma.logisticsProvider.create({
      data: {
        name: name.trim(),
        email,
        password: encryptedPassword,
      },
    });

    // Send activation url to email
    const token = jwt.sign(
      {
        userId: newUser.id,
      },
      process.env.JWT_KEY!,
      { expiresIn: "10m" }
    );

    const url = `https://logistics.agroxhub.com/auth/verify-email?token=${token}&type=create`;
    sendActivationLink(url, newUser.name, "create", newUser.email);

    // Send response to user
    res.status(201).json({
      status: true,
      message: "User account created successfully",
    });
  } catch (error) {
    throw new ServerException("Unable to create user", error);
  }
};

export const ActivateAccount = async (req: Request, res: Response) => {
  const { token } = req.body;

  validateRequiredFields([
    {
      name: "Activation link",
      value: token,
    },
  ]);

  let userId: string = "";

  try {
    const tokenData = jwt.verify(token, process.env.JWT_KEY!) as JwtPayload;

    if (!tokenData || !tokenData.userId) {
      throw new BadRequestException("Invalid or expired link");
    }

    userId = tokenData.userId;
  } catch (err) {
    const error = err as JsonWebTokenError;
    if (error.name === "TokenExpiredError") {
      throw new BadRequestException("Activation link expired.");
    }
    throw new BadRequestException("Invalid or expired link");
  }

  try {
    // Activate user account
    await prisma.logisticsProvider.update({
      where: {
        id: userId,
      },
      data: {
        isActive: true,
      },
    });

    res.status(200).json({
      status: true,
      message: "User account activated successfully",
    });
  } catch (error) {
    throw new BadRequestException("Invalid or expired link");
  }
};

export const ForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  validateRequiredFields([{ name: "Email Address", value: email }]);

  validateFieldType("email", email);

  const userExists = await prisma.logisticsProvider.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!userExists) {
    throw new NotFoundException("User does not exist");
  }

  // Send activation url to email
  const token = jwt.sign(
    {
      userId: userExists.id,
    },
    process.env.JWT_KEY!,
    { expiresIn: "10m" }
  );

  const url = `https://logistics.agroxhub.com/auth/verify-email?token=${token}&type=reset`;
  sendActivationLink(url, userExists.name, "reset", userExists.email);

  res.status(200).json({
    status: true,
    message: "Account reset url sent to email",
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

export const ResendActivationLink = async (req: Request, res: Response) => {
  const { token } = req.body;

  validateRequiredFields([
    {
      name: "Activation link",
      value: token,
    },
  ]);

  const { userId } = jwt.decode(token) as JwtPayload;

  if (!userId) {
    throw new BadRequestException("Invalid or expired link");
  }

  const user = await prisma.logisticsProvider.findUnique({
    where: {
      id: userId,
    },
    select: {
      name: true,
      email: true,
    },
  });

  if (!user) {
    throw new BadRequestException(
      "Activation link malformed. Please re-register"
    );
  }

  // Send new token url to email
  const newToken = jwt.sign(
    {
      userId,
    },
    process.env.JWT_KEY!,
    { expiresIn: "10m" }
  );

  const url = `https://logistics.agroxhub.com/auth/verify-email?token=${newToken}&type=create`;
  sendActivationLink(url, user.name, "create", user.email);

  return res.status(200).json({
    status: true,
    message: "New activation link sent to email",
  });
};

/*
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
*/

/* 
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
*/
