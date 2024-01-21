import express from "express";
import {
  createTransparent,
  createRexRoar,
} from "../controllers/create.js";

const router = express.Router();

router.post(
  "/transparent/:tokenId",
  createTransparent
);

router.get(
  "/rex/:tokenId",
  createRexRoar
);

export default router;