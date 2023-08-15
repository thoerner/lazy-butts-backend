import express from "express"
import { check } from "express-validator"
import { getToken, verifySignature, checkLoggedIn, getMerkleProof, isAllowListActive } from "../controllers/auth.js"

const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

const validateSignatureFormat = (signature) => {
    return /^0x[a-fA-F0-9]{130}$/.test(signature)
}

const router = express.Router()

router.get("/token", getToken)
router.post("/check", [
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("sessionToken", "Session token is required").not().isEmpty()
], checkLoggedIn)
router.post("/verify", [
    check("token", "Token is required").not().isEmpty(),
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("signature", "Signature is invalid").custom(validateSignatureFormat)
], verifySignature)
router.get("/proof", [
    check("address", "Address is invalid").custom(validateAddressFormat)
], getMerkleProof)
router.get("/allowlist", isAllowListActive)

export default router