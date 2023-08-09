import jsonwebtoken from 'jsonwebtoken'
import { verifyMessage } from 'ethers'
import redis from '../services/redisService.js'
import dotenv from 'dotenv'
dotenv.config()

const SESSION_EXPIRY_TIME = 3600; // 1 hour in seconds

export const getToken = async (req, res) => {
    const { address } = req.query
    const token = jsonwebtoken.sign({ address }, process.env.JWT_SECRET)
    await redis.set(address, token, 'EX', 300)
    res.json({ token })
}

export const verifySignature = async (req, res) => {
    const { address, signature, token } = req.body
    const storedToken = await redis.get(address)
    if (token !== storedToken) {
        res.status(401).json({ message: "Token is invalid" })
        return
    }
    const message = `You must sign this message to prove ownership of your wallet address.\nBy signing this message, you agree to [Your App's Name]'s Terms of Service and acknowledge that we use cookies to keep you logged in.\n${token}`
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

    const storedSessionToken = await redis.get(`session:${address}`)
    if (sessionToken !== storedSessionToken) {
        res.status(401).json({ message: "Session token is invalid or expired" })
        return
    } else {
        res.json({ 
            success: true,
            message: "Session token is valid" 
        })
    }
}