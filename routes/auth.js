import express from "express"
import { check } from "express-validator"
import { getToken } from "../controllers/auth.js"

const router = express.Router()

router.get("/token", getToken)

export default router