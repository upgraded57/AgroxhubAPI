import express, { NextFunction, Request, Response } from "express";
import indexRoute from "./routes/index";
import * as dotenv from "dotenv";
import { errorHandler } from "./middlewares/errors";
import cors from "cors";
dotenv.config();
import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "*", // Replace '*' with your client domain in production
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.use("/api/v1", indexRoute);

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
