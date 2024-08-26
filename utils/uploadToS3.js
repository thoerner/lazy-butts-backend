import { promises as fs } from 'fs';
import s3Client, { PutObjectCommand } from '../services/s3Service.js';

const BUCKET = 'lazybutts';

export const uploadImageToS3 = async (imagePath, imageName, key) => {
    try {
        const fileContent = await fs.readFile(imagePath);
        const params = {
            Bucket: BUCKET,
            Key: `${key}/${imageName}.png`,
            Body: fileContent,
            ACL: 'public-read',
        }
        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);
        console.log(`File ${imageName}.png uploaded to S3`);
        // await fs.unlink(imagePath);
    } catch (err) {
        console.error(err);
    }
}