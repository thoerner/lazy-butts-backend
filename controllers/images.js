
import { verifySessionAuth, getAddressFromSessionToken } from '../utils/authTools.js'
import s3, { GetObjectCommand } from '../services/s3Service.js'
import { db, GetItemCommand } from "../services/dbService.js"

const BUTT_KEY  = 'public/images/butts/'
const FULL_BODY_KEY = 'public/images/full-lions/'
const SMALL_BUTT_KEY = 'public/images/lazy-butts-small/'
const MEDIUM_BUTT_KEY = 'public/images/lazy-butts-medium/'

export const getButt = async (req, res) => {
    const { imageName } = req.params
    const { authorization, address } = req.headers

    try {
        await verifySessionAuth(address, authorization)
        await authorizeButtAccess(address, imageName)
        getAndReturnImageFromS3(`${BUTT_KEY}${imageName}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
    }
}

export const getSmallButt = async (req, res) => {
    const { imageName } = req.params
    const { authorization, address } = req.headers

    try {
        await verifySessionAuth(address, authorization)
        await authorizeButtAccess(address, imageName)
        getAndReturnImageFromS3(`${SMALL_BUTT_KEY}${imageName}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
    }
}

export const getMediumButt = async (req, res) => {
    const { imageName } = req.params
    const { authorization, address } = req.headers

    try {
        await verifySessionAuth(address, authorization)
        await authorizeButtAccess(address, imageName)
        getAndReturnImageFromS3(`${MEDIUM_BUTT_KEY}${imageName}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
    }
}

export const getFullBody = async (req, res) => {
    const { imageName } = req.params
    const { authorization, address } = req.headers

    try {
        await verifySessionAuth(address, authorization)
        await authorizeButtAccess(address, imageName)
        getAndReturnImageFromS3(`${FULL_BODY_KEY}${imageName}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
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

async function getAndReturnImageFromS3(key, res) {  // <-- 'res' added as parameter
    const params = {
        Bucket: 'lazybutts',
        Key: key
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

async function authorizeButtAccess(address, imageName) {
    const imageNamePrefix = imageName.split('.')[0]
    const buttsArray = await checkButtsOwnership(address)
    if (!buttsArray.includes(imageNamePrefix)) {
        throw new Error("You don't own this butt")
    }
}