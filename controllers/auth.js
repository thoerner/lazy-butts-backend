import jsonwebtoken from 'jsonwebtoken'
import { verifyMessage } from 'ethers'
import { verifySessionAuth } from '../utils/authTools.js'
import redis from '../services/redisService.js'
import dotenv from 'dotenv'
dotenv.config()

const SESSION_EXPIRY_TIME = 86400 // 24 hours
const CHALLENGE_EXPIRY_TIME = 300 // 5 minutes

export const getToken = async (req, res) => {
    const { address } = req.query
    const token = jsonwebtoken.sign({ address }, process.env.JWT_SECRET)
    await redis.set(address, token, 'EX', CHALLENGE_EXPIRY_TIME)
    res.json({ token })
}

export const verifySignature = async (req, res) => {
    const { address, signature, token } = req.body
    const storedToken = await redis.get(address)
    if (token !== storedToken) {
        res.status(401).json({ message: "Token is invalid" })
        return
    }
    const message = `You must sign this message to prove ownership of your wallet address.\nBy signing this message, you agree to Lazy Butt's Terms of Service and acknowledge that we use cookies to keep you logged in.\n${token}`
    const recoveredAddress = verifyMessage(message, signature)
    console.log(recoveredAddress)
    if (recoveredAddress === address) {
        const sessionToken = jsonwebtoken.sign({ address }, process.env.JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_TIME}s` })
        await redis.set(`session:${address}`, sessionToken, 'EX', SESSION_EXPIRY_TIME)

        res.json({
            success: true,
            message: "Signature is valid",
            sessionToken
        })
    } else {
        res.status(401).json({ message: "Signature is invalid" })
    }
}

export const checkLoggedIn = async (req, res) => {
    const { address, sessionToken } = req.body

    try {
        await verifySessionAuth(address, sessionToken)
        res.json({ success: true, message: "User is logged in" })
    } catch (err) {
        res.status(401).json({ message: err })
    }
}