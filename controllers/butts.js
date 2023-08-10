import { verifySessionAuth } from "../utils/authTools.js"
import { validationResult } from "express-validator"

export const getButt = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() })
        return
    }
    const { address, sessionToken } = req.body
    const { imageName } = req.params

    try {
        await verifySessionAuth(address, sessionToken)
    } catch (err) {
        res.status(401).json({ message: err })
    }

    res.json({ message: `You got ${imageName}` })
}