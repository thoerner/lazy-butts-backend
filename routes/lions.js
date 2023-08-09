import express from "express"
import { check } from "express-validator"
import { getLions } from "../controllers/lions.js"

const router = express.Router()

const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

router.get("/:address", 
    [
        check("address", "Address is invalid").custom(validateAddressFormat)
    ],
getLions)

export default router