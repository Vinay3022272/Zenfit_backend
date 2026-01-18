import express from "express";
import "dotenv/config";
import { connectDB } from "./lib/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";

import fitnessRoutes from "./routes/fitness.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const port = process.env.PORT || 5600;

// ✅ FIXED CORS (MOST IMPORTANT PART)
app.use(
  cors({
    origin: true,   
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/fitness", fitnessRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Fitness API Server is running!" });
});

app.listen(port, () => {
  connectDB();
  console.log(`Server running at http://localhost:${port}`);
});
