import { JsonRpcProvider } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const RPC_URL = process.env.ENV === 'dev' ? process.env.RPC_URL_TEST : process.env.RPC_URL
const provider = new JsonRpcProvider(RPC_URL)
export const ethProvider = new JsonRpcProvider(process.env.RPC_URL)

export default provider