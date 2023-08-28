import express from "express"
import { check } from "express-validator"
import { getButt, getFullBody, getFullBodyThumb, getSmallButt, getMediumButt } from "../controllers/images.js"

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

router.get("/butt/:imageName", [
    check("address", "Address is invalid").isLength({ min: 42, max: 42 }).withMessage("Address is invalid"),
    check("authorization", "Authorization header is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getButt)
router.get("/full/:imageName", [
    check("address", "Address is invalid").isLength({ min: 42, max: 42 }).withMessage("Address is invalid"),
    check("authorization", "Authorization header is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getFullBody)
router.get("/full-thumb/:imageName", [
    check("address", "Address is invalid").isLength({ min: 42, max: 42 }).withMessage("Address is invalid"),
    check("authorization", "Authorization header is required").not().isEmpty(),
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getFullBodyThumb)
router.get("/small/:imageName", [
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getSmallButt)
router.get("/medium/:imageName", [
    check("imageName", "Invalid image format.").custom(validateImageExtension),
], getMediumButt)

export default router