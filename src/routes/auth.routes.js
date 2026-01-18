import express from "express"
import { login } from "../controllers/auth.controller.js"
import { authCheck } from "../middlewares/healthCheck.js"
import { getMe } from "../controllers/auth.controller.js"

const router = express.Router()

router.post("/login", login)
router.get("/me", authCheck, getMe)

export default router