import { verifySessionAuth } from "../utils/authTools.js"
import { validationResult } from "express-validator"
import provider from "../services/ethService.js"
import { Contract } from "ethers"
import LazyButtsAbi from "../contracts/LazyButts.json" assert { type: "json" }

const BUTTS_CONTRACT_ADDRESS = process.env.ENV === 'dev' ? process.env.BUTTS_CONTRACT_ADDRESS_TEST : process.env.BUTTS_CONTRACT_ADDRESS

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

    // call contract
    const contract = new Contract(BUTTS_CONTRACT_ADDRESS, LazyButtsAbi, provider)
    const butts = await contract.walletOfOwner(address)
    // deconstruct array of BigInts
    const buttsArray = butts.map((butt) => butt.toString())
    res.json(buttsArray)
}