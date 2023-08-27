import { verifySessionAuth } from "../utils/authTools.js"
import { validationResult } from "express-validator"
import { db, GetItemCommand } from "../services/dbService.js"

export const getAllButts = async (req, res) => {
    try {
        const data = await db.send(new GetItemCommand({
            TableName: "config",
            Key: {
                "setting": {
                    S: "tokenConfig"
                }
            }
        }))
        res.json(data.Item.mintedTokens.NS.map(butt => butt))
    } catch (err) {
        res.status(404).json({ message: "Butts not found" })
    }
}

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

export const getButts = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() })
        return
    }
    const { address } = req.params

    const params = {
        TableName: "users",
        Key: {
            "address": {
                S: address
            }
        }
    }

    let buttsArray = []
    try {
        const data = await db.send(new GetItemCommand(params))
        buttsArray = data.Item.butts.L.map(butt => butt.N)
    } catch (err) {
        res.status(404).json({ message: "Butts not found" })
        return
    }
    
    res.json(buttsArray)
}