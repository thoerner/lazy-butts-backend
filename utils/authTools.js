import redis from '../services/redisService.js'
import jsonwebtoken from 'jsonwebtoken'

export function getAddressFromSessionToken(sessionToken) {
    try {
        const decoded = jsonwebtoken.verify(sessionToken, process.env.JWT_SECRET);
        return decoded.address;
    } catch (err) {
        throw new Error("Invalid or expired session token");
    }
}

export function verifySessionAuth(address, sessionToken) {
    return new Promise(async (resolve, reject) => {
        const storedSessionToken = await redis.get(`session:${address}`)
        if (sessionToken !== storedSessionToken) {
            reject("Session token is invalid or expired")
        } else {
            resolve()
        }
    })
}