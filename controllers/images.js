
import { verifySessionAuth } from '../utils/authTools.js'
import s3, { GetObjectCommand, GetObjectAclCommand } from '../services/s3Service.js'
import db, { GetItemCommand } from "../services/dbService.js"

const BUTT_KEY  = 'public/images/butts/'
const FULL_BODY_KEY = 'public/images/full-lions/'
const FULL_BODY_THUMB_KEY = 'public/images/small-full-lions/'
const SMALL_BUTT_KEY = 'public/images/small-lazy-butts/'
const MEDIUM_BUTT_KEY = 'public/images/medium-lazy-butts/'

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

    try {
        getAndReturnImageFromS3Public(`${SMALL_BUTT_KEY}${imageName}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
    }
}

export const getMediumButt = async (req, res) => {
    const { imageName } = req.params

    try {
        getAndReturnImageFromS3Public(`${MEDIUM_BUTT_KEY}${imageName}`, res)
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

export const getFullBodyThumb = async (req, res) => {
    const { imageName } = req.params
    const { authorization, address } = req.headers

    try {
        await verifySessionAuth(address, authorization)
        await authorizeButtAccess(address, imageName)
        getAndReturnImageFromS3(`${FULL_BODY_THUMB_KEY}${imageName}`, res)
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

async function getAndReturnImageFromS3Public(key, res) {
    // check if the image is public
    const aclParams = {
        Bucket: 'lazybutts',
        Key: key
    }

    const aclCommand = new GetObjectAclCommand(aclParams)
    try {
        const aclData = await s3.send(aclCommand)
        const Grantee = aclData.Grants.find(grant => grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers')
        if (Grantee ? Grantee.Permission === 'READ' : false) {
            const params = {
                Bucket: 'lazybutts',
                Key: key
            }
            const command = new GetObjectCommand(params)
            try {
                const data = await s3.send(command)
                res.writeHead(200, { 'Content-Type': 'image/png' })
                data.Body.pipe(res)  // Piping the data directly to the response
            } catch (error) {
                console.log("Caught an error:", error);
                return res.status(400).json({ error: error })
            }
        } else {
            return res.status(401).json({ error: 'You are not authorized to view this image' })
        }
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