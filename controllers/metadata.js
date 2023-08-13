import s3, { GetObjectCommand, GetObjectAclCommand } from '../services/s3Service.js'

const METADATA_KEY = 'public/metadata/'

export const getMetadata = async (req, res) => {
    const { id } = req.params

    try {
        getPublicMetadataFromS3(`${METADATA_KEY}${id}`, res)
    } catch (error) {
        return res.status(401).json({ error: error })
    }
}

async function getPublicMetadataFromS3(key, res) {
    // check if the metadata is public
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
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': 'inline'
                })
                data.Body.pipe(res)
            } catch (error) {
                console.log("Caught an error:", error);
                return res.status(400).json({ error: error })
            }
        } else {
            return res.status(401).json({ error: 'You are not authorized to view this metadata' })
        }
    } catch (error) {
        console.log("Caught an error:", error);
        return res.status(400).json({ error: error })
    }
}