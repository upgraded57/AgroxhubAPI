import { PrismaClient, User } from "@prisma/client";
import { BadRequestException } from "../exceptions/bad-request";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import { ServerException } from "../exceptions/server-error";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({
  path: "./.env",
});

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export const findUser = async (
  type: "email" | "token" | "id",
  value: string
) => {
  let user = null;

  // if(token) {
  //     user = await prisma.user.findFirst({
  //         where:
  //     })
  // }

  if (type === "id") {
    user = await prisma.user.findFirst({
      where: {
        id: value,
      },
      include: {
        cart: true,
      },
    });
  }

  if (type === "email") {
    user = await prisma.user.findFirst({
      where: {
        email: value,
      },
      include: {
        cart: true,
      },
    });
  }
  return user;
};

export const validateRequiredFields = (
  fields: { name: string; value: string }[]
) => {
  const emptyFields = fields
    .filter((field) => !field.value)
    .map((field) => field.name);
  if (emptyFields.length) {
    throw new BadRequestException(`${emptyFields.join(", ")} fields required`);
  }
};

export const validateFieldType = (
  type: "email" | "name" | "phone" | "password" | "otp",
  value: string
): boolean => {
  // Define regex patterns for each type
  const patterns: { [key: string]: RegExp } = {
    name: /^[A-Za-z]+(\s[A-Za-z]+)+$/, // At least two words, letters only, space-separated
    phone: /^(234\d{10}|(07|08|09)\d{9})$/, // Nigerian number format
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, // At least 8 chars, uppercase, lowercase, number
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Standard email validation
    otp: /^\d{6}$/,
  };

  // Get the regex pattern for the provided type
  const pattern = patterns[type];

  if (!pattern) {
    throw new Error(`Validation for type "${type}" is not defined.`);
  }

  // Test the value against the regex
  if (!pattern.test(value)) {
    throw new BadRequestException(`Invalid ${type} format supplied`);
  } else {
    return true;
  }
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

export const createOtp = async (userId: string) => {
  // Generate a six-digit OTP
  const generatedOtp = generateOtp();

  // Blacklist all unused OTPs associated with the user
  await prisma.otp.updateMany({
    where: {
      userId,
      used: false, // Update only unused OTPs
    },
    data: {
      used: true,
    },
  });

  // Store the new OTP in the database
  const newOtp = await prisma.otp.create({
    data: {
      user: {
        connect: {
          id: userId,
        },
      },
      otp: generatedOtp,
    },
  });

  // Return new OTP
  return newOtp.otp;
};

export const sendOtp = (
  otp: number,
  type: "create" | "reset",
  recipient: string
) => {
  const transporter = nodemailer.createTransport({
    host: "wghp7.wghservers.com",
    port: 465,
    secure: true,
    requireTLS: true,
    auth: {
      user: process.env.MAIL_SENDER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: '"Agroxhub" <developer@agroxhub.com>',
    to: recipient,
    subject:
      type === "create"
        ? "Welcome to Agroxhub!"
        : "Complete your Agroxhub account recovery",
    html: `<html lang="en">
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="X-UA-Compatible" content="ie=edge" />

                <link
                  href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
                  rel="stylesheet"
                />
              </head>
              <body
                style="
                  margin: 0;
                  width: 100%;
                  max-width: 700px;
                  margin-inlile: auto;
                  font-family: 'Inter', sans-serif;
                  background: #ffffff;
                  font-size: 14px;
                "
              >
                <div
                  style="
                    margin: 0 auto;
                    padding: 20px;
                    background: #f4f7ff;
                    background-repeat: no-repeat;
                    background-size: 800px 452px;
                    background-position: top center;
                    font-size: 14px;
                    color: #434343;
                  "
                >
                  <main>
                    <div
                      style="
                        margin: 0;
                        margin-top: 20px;
                        padding: 60px 30px;
                        background: #ffffff;
                        border-radius: 10px;
                        text-align: center;
                      "
                    >
                      <div style = "width: 100%; display: flex; justify-content: center; align-items: center; margin-bottom: 40px"> 
                        <img src = "https://res.cloudinary.com/dkc54wbyx/image/upload/v1727954368/logo1_gyuktc.png" style = "width: 140px; object-fit: cover" />
                      </div>
                      
                      <div style="width: 100%; max-width: 489px; margin: 0 auto">
                        <h1
                          style="
                            margin: 0;
                            font-size: 24px;
                            font-weight: 500;
                            color: #1f1f1f;
                          "
                        >
                          ${
                            type === "create"
                              ? "Welcome to Agroxhub!"
                              : "Complete your Agroxhub account recovery"
                          }
                        </h1>
                        <p
                          style="
                            margin: 0;
                            margin-top: 17px;
                            font-size: 16px;
                            font-weight: 500;
                          "
                        >
                          Hi,
                        </p>
                        <p
                          style="
                            margin: 0;
                            margin-top: 17px;
                            font-weight: 500;
                            letter-spacing: 0.56px;
                          "
                        >
                          To complete your account ${
                            type === "create" ? "creation" : "recovery"
                          }, please use the following OTP.
                        </p>
                        
                        <p style="color: #36e18d; font-weight: bold; font-size: 1.5em">
                          ${otp}
                        </p>
                        <p
                          style="
                            margin: 0;
                            margin-top: 17px;
                            font-weight: 500;
                            letter-spacing: 0.56px;
                          "
                        >
                          This code is valid for
                          <span style="font-weight: 600; color: #1f1f1f">5 minutes</span>.
                        </p>

                        <p
                          style="
                            margin: 0;
                            margin-top: 17px;
                            font-weight: 500;
                            letter-spacing: 0.56px;
                          "
                        >
                          <b>Important</b>: Keep this OTP confidential and do not share it with anyone
                        </p>

                        <p
                          style="
                            margin: 0;
                            margin-top: 17px;
                            font-weight: 500;
                            letter-spacing: 0.56px;
                          "
                        >
                          If you didn't initiate this process, you can safely ignore this message
                        </p>
                      </div>
                    </div>

                    <p
                      style="
                        max-width: 400px;
                        margin: 0 auto;
                        margin-top: 90px;
                        text-align: center;
                        font-weight: 500;
                        color: #8c8c8c;
                      "
                    >
                      Need help? Ask at
                      <a
                        href="mailto:hello@agroxhub.com"
                        style="color: #7286e9; text-decoration: none"
                        >Support Center</a
                      >
                    </p>
                  </main>

                  <footer
                    style="
                      width: 100%;
                      max-width: 490px;
                      margin: 20px auto 0;
                      text-align: center;
                      border-top: 1px solid #e6ebf1;
                    "
                  >
                    <p
                      style="
                        margin: 0;
                        margin-top: 40px;
                        font-size: 16px;
                        font-weight: 600;
                        color: #434343;
                      "
                    >
                      Agroxhub
                    </p>
                    <p style="margin: 0; margin-top: 8px; color: #434343">
                      Feeding the Nation, one person at a time
                    </p>

                    <p style="margin: 0; margin-top: 16px; color: #434343">
                      Copyright © 2025 Agroxhub. All rights reserved.
                    </p>
                  </footer>
                </div>
              </body>
            </html>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return;
    } else {
      console.log("Email Sent" + info.response);
      return "Email sent: " + info.response;
    }
  });
};

export const uploadAvatar = async (avatar: string) => {
  // Configuration
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Upload an image
  const uploadResult = await cloudinary.uploader
    .upload(avatar, {
      folder: "agroxhub",
    })
    .catch((error) => {
      throw new ServerException("Unable to upload avatar", error);
    });

  return uploadResult.url;
};

export const uploadProductImages = async (images: Express.Multer.File[]) => {
  // Configuration
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Map images to upload promises
  const uploadPromises = images.map(async (item) => {
    try {
      const uploadResult = await cloudinary.uploader.upload(item.path, {
        folder: "product images",
      });

      const url = uploadResult.url;
      return url;
    } catch (error) {
      throw new ServerException("Unable to upload product image", error);
    }
  });

  // Wait for all uploads to complete
  const imgPaths = await Promise.all(uploadPromises);

  return imgPaths;
};

export const generateOrderNumber = (user: User) => {
  const initials =
    user.name.toUpperCase().split("")[0] + user.name.toUpperCase().split("")[1];
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${initials}-${year}${month}${day}_${hours}${minutes}${seconds}`;
};
