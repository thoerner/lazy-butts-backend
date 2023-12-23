import express from "express";
import {
  createTransparent,
} from "../controllers/create.js";

const router = express.Router();

router.post(
  "/transparent/:tokenId",
  createTransparent
);

export default router;