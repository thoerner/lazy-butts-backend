import { DynamoDBClient, ScanCommand, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb"
import dotenv from "dotenv"

dotenv.config()

export const db = new DynamoDBClient({ region: "us-east-1" })

export { ScanCommand, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand }