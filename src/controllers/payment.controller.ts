import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { BadRequestException } from "../exceptions/bad-request";
import { NotFoundException } from "../exceptions/not-found";
import {
  generateOrderNumber,
  validateRequiredFields,
} from "../functions/functions";
import { ServerException } from "../exceptions/server-error";
import { UnauthorizedException } from "../exceptions/unauthorized";
import axios from "axios";
import { ForbiddenException } from "../exceptions/forbidden";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

const paystackInstance = axios.create({
  baseURL: "https://api.paystack.co",
});

paystackInstance.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`;
  config.headers["Content-Type"] = "application/json";
  return config;
});

export const InitiatePayment = async (req: Request, res: Response) => {
  const user = req.user;
  const { orderNumber } = req.body;

  validateRequiredFields([
    {
      name: "Order Number",
      value: orderNumber,
    },
  ]);

  // Fetch order
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      userId: user?.id,
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  const data = {
    email: user?.email,
    amount: Math.round(order.totalAmount * 100), // Multiply by 100 to get amount in kobo for paystack
  };
  try {
    const paystackRes = await paystackInstance.post(
      "/transaction/initialize",
      data
    );

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        accessCode: paystackRes.data.data.access_code,
        referenceCode: paystackRes.data.data.reference,
      },
    });

    return res.status(200).json({
      status: true,
      message: "Payment initiated successfully",
      data: paystackRes.data.data,
    });
  } catch (error) {
    console.log(error);
    throw new ServerException("Something went wrong", error);
  }
};

export const VerifyPayment = async (req: Request, res: Response) => {
  const user = req.user;
  const { referenceCode } = req.body;

  validateRequiredFields([
    {
      name: "Reference Code",
      value: referenceCode,
    },
  ]);

  // Check if payment is already verified
  const order = await prisma.order.findFirst({
    where: {
      userId: user?.id,
      referenceCode: referenceCode,
    },
  });

  if (!order) {
    throw new NotFoundException("Cannot find order");
  }

  if (order.paymentStatus === "paid") {
    return res.status(403).json({
      status: false,
      message: "Payment already verified",
      order,
    });
  }

  // Send codes to paystack for verification
  try {
    const paystackRes = await paystackInstance.get(
      `transaction/verify/${referenceCode}`
    );

    if (
      paystackRes.data.status === true &&
      paystackRes.data.data.status === "success"
    ) {
      const newOrder = await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentStatus: "paid",
        },
      });

      // Clear user's cart
      await prisma.cart.deleteMany({
        where: {
          userId: order.userId,
        },
      });

      return res.status(200).json({
        status: true,
        message: "Payment verified successfully",
        order: newOrder,
      });
    } else {
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentStatus: "failed",
        },
      });
      throw new ServerException("Payment was not completed. Please retry");
    }
  } catch (error) {
    throw new ServerException("Cannot verify payment. Please retry");
  }
};
