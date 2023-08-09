import jsonwebtoken from 'jsonwebtoken'
import { verifyMessage } from 'ethers'
import redis from '../services/redisService.js'
import dotenv from 'dotenv'
dotenv.config()

export const getToken = async (req, res) => {
    const { address } = req.query
    const token = jsonwebtoken.sign({ address }, process.env.JWT_SECRET)
    await redis.set(address, token)
    res.json({ token })
}

export const verifySignature = async (req, res) => {
    const { address, signature, token } = req.body
    const storedToken = await redis.get(address)
    if (token !== storedToken) {
        res.status(401).json({ message: "Token is invalid" })
        return
    }
    const message = `You must sign this message to prove ownership of your wallet address.\n${token}`
    const recoveredAddress = verifyMessage(message, signature)
    console.log(recoveredAddress)
    if (recoveredAddress === address) {
        res.json({ 
            success: true,
            message: "Signature is valid" 
        })
    } else {
        res.status(401).json({ message: "Signature is invalid" })
    }
}