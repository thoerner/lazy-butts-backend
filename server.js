import express from "express"
import bodyParser from "body-parser"
import helmet from "helmet"
import cors from "cors"
import lionRoutes from "./routes/lions.js"

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(helmet())
app.use(cors())

app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.use("/api/lions", lionRoutes)

app.listen(3000, () => {
    console.log("Server is listening on port 3000")
})