import redis from '../services/redisService.js'

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