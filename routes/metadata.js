import express from "express"
import { getMetadata } from "../controllers/metadata.js"

const router = express.Router()

router.get("/:id", getMetadata)

export default router