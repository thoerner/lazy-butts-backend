import express from "express"
import { check } from "express-validator"
import { getLions, getCubs } from "../controllers/lions.js"

const router = express.Router()

const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

router.get("/:address", 
    [
        check("address", "Address is invalid").custom(validateAddressFormat)
    ],
getLions)

router.get("/cubs/:address", 
    [
        check("address", "Address is invalid").custom(validateAddressFormat)
    ],
getCubs)

export default router