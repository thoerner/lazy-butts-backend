import { S3Client, GetObjectCommand, PutObjectAclCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config()

export const s3 = new S3Client({ region: 'us-east-1' })

export { GetObjectCommand, PutObjectAclCommand }

export default s3