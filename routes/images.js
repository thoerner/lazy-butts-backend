import express from "express"
import { check } from "express-validator"
import { getButt, getFullBody } from "../controllers/images.js"

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

router.get("/butt/:imageName", [
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("sessionToken", "Session token is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getButt)
router.get("/full/:imageName", [
    check("address", "Address is invalid").custom(validateAddressFormat),
    check("sessionToken", "Session token is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getFullBody)

export default router