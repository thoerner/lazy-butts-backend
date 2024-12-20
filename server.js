import express from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import lionRoutes from "./routes/lions.js";
import authRoutes from "./routes/auth.js";
import buttRoutes from "./routes/butts.js";
import imageRoutes from "./routes/images.js";
import metadataRoutes from "./routes/metadata.js";
import createRoutes from "./routes/create.js";
// import "./services/buttService.js"

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());

// Define CORS options
const corsOptions = {
    origin: '*',
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // or any other HTTP methods you need
    optionsSuccessStatus: 204,
};

// Use CORS middleware with options
app.use(cors(corsOptions));

// Add Morgan middleware for logging
app.use(morgan('combined'));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/lions", lionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/butts", buttRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/create", createRoutes);

app.listen(PORT, () => {
  console.log("Server is listening on port", PORT);
});