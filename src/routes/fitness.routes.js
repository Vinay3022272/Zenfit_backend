import express from "express";
import { generateFitnessProgramController } from "../controllers/fitness.controller.js";

const router = express.Router();

// POST /api/fitness/generate-program
router.post("/generate-program", generateFitnessProgramController);

export default router;