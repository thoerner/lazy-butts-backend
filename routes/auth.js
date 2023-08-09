import express from "express"
import { check } from "express-validator"
import { getToken, verifySignature } from "../controllers/auth.js"

const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

const validateSignatureFormat = (signature) => {
    return /^0x[a-fA-F0-9]{130}$/.test(signature)
}

const router = express.Router()

router.get("/token", getToken)
router.post("/verify", [
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("signature", "Signature is invalid").custom(validateSignatureFormat)
], verifySignature)

export default router