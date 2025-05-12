import { ethers } from 'ethers'
import { validationResult } from 'express-validator'
import ethProvider from '../services/ethService.js'
import LazyLions from '../contracts/LazyLions.json' with { type: "json" }
import { getTokenData } from "../utils/cubMetadata.js"

const LION_CONTRACT_ADDRESS = process.env.ENV === 'dev' ? process.env.LION_CONTRACT_ADDRESS_TEST : process.env.LION_CONTRACT_ADDRESS

export const getLions = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
    }
    const { address } = req.params
    const lionContract = new ethers.Contract(LION_CONTRACT_ADDRESS, LazyLions, ethProvider)
    const lions = await lionContract.tokensOfOwner(address)
    const lionIds = lions.map(lion => lion.toString())
    res.json(lionIds)
}

export const getCubs = async (req, res) => {
    const { address } = req.params
    console.log(`Getting cubs for ${address}`)
    const cubs = await getTokenData(address)
    res.json(cubs)
}