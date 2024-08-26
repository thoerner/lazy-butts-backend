import express from "express"
import { check } from "express-validator"

import { getButts, getAllButts } from "../controllers/butts.js"

const router = express.Router()

const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

router.get("/", getAllButts)
router.get("/:address", 
    check("address", "Address is invalid").custom(validateAddressFormat),
getButts)

export default router