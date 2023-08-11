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
    const buttsBalance = Number(await contract.balanceOf(address))
    console.log(buttsBalance)
    if (buttsBalance === 0) {
        res.status(404).json({ message: "No butts found" })
        return
    }
    const buttsArray = []
    for (let i = 0; i < 10000; i++) {
        if (buttsArray.length === buttsBalance) {
            break
        }
        let buttOwner
        try {
            buttOwner = await contract.ownerOf(i)
        } catch (err) {
            console.log(err)
            continue
        }
        if (buttOwner === address) {
            buttsArray.push(i)
        }
    }

    res.json(buttsArray)
}