import jsonwebtoken from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

export const getToken = async (req, res) => {
    const token = jsonwebtoken.sign({ address: req.query.address }, process.env.JWT_SECRET)
    res.json({ token })
}