import jsonwebtoken from 'jsonwebtoken'
import { verifyMessage, Contract } from 'ethers'
import { verifySessionAuth } from '../utils/authTools.js'
import redis from '../services/redisService.js'
import dotenv from 'dotenv'
import ALLOW_LIST from '../utils/addresses.json' assert { type: "json" }
import { makeTree, getRoot, getProof } from '../utils/merkleTools.js';
import provider from '../services/ethService.js'
import LazyButtsAbi from '../contracts/LazyButts.json' assert { type: "json" }
dotenv.config()

const SESSION_EXPIRY_TIME = 86400 // 24 hours
const CHALLENGE_EXPIRY_TIME = 300 // 5 minutes

const CONTRACT_ADDRESS = process.env.ENV === 'dev' ? process.env.BUTTS_CONTRACT_ADDRESS_TEST : process.env.BUTTS_CONTRACT_ADDRESS

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

export const getMerkleProof = async (req, res) => {
    const { address } = req.query

    const tree = makeTree(ALLOW_LIST)
    const root = getRoot(tree)

    const { success, data, error } = getProof(tree, address)

    if (success) {
        res.json({
            success: true,
            root,
            proof: data
        })
    } else {
        res.status(500).json({
            success: false,
            message: error
        })
    }
}

export const isAllowListActive = async (req, res) => {

    const contract = new Contract(CONTRACT_ADDRESS, LazyButtsAbi, provider)
    let isActive
    try {
        isActive = await contract.isAllowListActive()
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching allow list status.'
        })
        return
    }

    res.json({
        success: true,
        isActive
    })
}

export const isMintActive = async (req, res) => {

    const contract = new Contract(CONTRACT_ADDRESS, LazyButtsAbi, provider)
    let isActive
    try {
        isActive = await contract.isMintActive()
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching mint status.'
        })
        return
    }

    res.json({
        success: true,
        isActive
    })
}


