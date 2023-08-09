import { JsonRpcProvider } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const provider = new JsonRpcProvider(process.env.RPC_URL)

export default provider