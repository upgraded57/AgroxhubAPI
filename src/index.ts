import express, { NextFunction, Request, Response } from "express";
import indexRoute from "./routes/commerce/index";
import logisticsIndexRoute from "./routes/logistics/index";
import * as dotenv from "dotenv";
import { errorHandler } from "./middlewares/errors";
import cors from "cors";
dotenv.config();
import { User, Region, Cart } from "@prisma/client";

type ExtendedUser = Omit<User, "password"> & {
  region: Region | null;
  cart: Cart | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: ExtendedUser;
      userId?: string;
    }
  }
}

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.send("Welcome to Agroxhub's API infrastructure");
});
app.use("/api/v1", indexRoute);
app.use("/api/logistics/v1", logisticsIndexRoute);

// Catch-All Route for Unhandled Endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: false,
    message: "Endpoint not found",
  });
});

// Error handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
