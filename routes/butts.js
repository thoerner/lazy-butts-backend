import express from "express"
import { check } from "express-validator"

import { getButts, getButt } from "../controllers/butts.js"

const router = express.Router()

const validateImageExtension = (imageName) => {
    if (!imageName) {
        throw new Error('imageName is not defined');
    }

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    if (!allowedExtensions.some(ext => imageName.endsWith(ext))) {
        throw new Error('Invalid image format.');
    }
    return true;
};


const validateAddressFormat = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

router.get("/images/:imageName", [
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("sessionToken", "Session token is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getButt)

router.get("/:address", 
    check("address", "Address is invalid").custom(validateAddressFormat),
getButts)

export default router