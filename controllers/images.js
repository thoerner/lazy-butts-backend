
import { verifySessionAuth, getAddressFromSessionToken } from '../utils/authTools.js'
import s3, { GetObjectCommand } from '../services/s3Service.js'
import { db, GetItemCommand } from "../services/dbService.js"

const BUTT_KEY  = 'public/images/butts/'
const FULL_BODY_KEY = 'public/images/full-lions/'

export const getButt = async (req, res) => {
    const { imageName } = req.params
    const { authorization } = req.headers

    const address = getAddressFromSessionToken(authorization)

    try {
        await verifySessionAuth(address, authorization)
    } catch (error) {
        return res.status(401).json({ error: error })
    }

    const imageNamePrefix = imageName.split('.')[0]
    const buttsArray = await checkButtsOwnership(address)
    console.log(`buttsArray: ${buttsArray}`)
    console.log(`imageNamePrefix: ${imageNamePrefix}`)
    if (!buttsArray.includes(imageNamePrefix)) {
        return res.status(401).json({ error: "You don't own this butt" })
    }

    const params = {
        Bucket: 'lazybutts',
        Key: `${BUTT_KEY}${imageName}`
    }

    const command = new GetObjectCommand(params)

    try {
        const data = await s3.send(command)
        res.writeHead(200, { 'Content-Type': data.ContentType })
        data.Body.pipe(res)  // Piping the data directly to the response
    } catch (error) {
        console.log("Caught an error:", error);
        return res.status(400).json({ error: error })
    }
}

export const getFullBody = async (req, res) => {
    const { imageName } = req.params
    const { authorization } = req.headers

    const address = getAddressFromSessionToken(authorization)

    try {
        await verifySessionAuth(address, sessionToken)
    } catch (error) {
        return res.status(401).json({ error: error })
    }

    const imageNamePrefix = imageName.split('.')[0]
    const buttsArray = await checkButtsOwnership(address)
    if (!buttsArray.includes(imageNamePrefix)) {
        return res.status(401).json({ error: "You don't own this butt" })
    }

    const params = {
        Bucket: 'lazybutts',
        Key: `${FULL_BODY_KEY}${imageName}`
    }

    const command = new GetObjectCommand(params)

    try {
        const data = await s3.send(command)
        res.writeHead(200, { 'Content-Type': data.ContentType })
        data.Body.pipe(res)  // Piping the data directly to the response
    } catch (error) {
        console.log("Caught an error:", error);
        return res.status(400).json({ error: error })
    }
}

async function checkButtsOwnership(address) {
    const params = {
        TableName: "users",
        Key: {
            "address": {
                S: address
            }
        }
    }

    let buttsArray = []
    try {
        const data = await db.send(new GetItemCommand(params))
        buttsArray = data.Item.butts.L.map(butt => butt.N)
    } catch (err) {
        return []
    }
    
    return buttsArray
}