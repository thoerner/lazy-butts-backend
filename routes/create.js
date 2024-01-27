import express from "express";
import {
  createTransparent,
  createRexRoar,
  createValentine,
} from "../controllers/create.js";

const router = express.Router();

router.post(
  "/transparent/:tokenId",
  createTransparent
);

router.get(
  "/valentine/:tokenId",
  createValentine
);

router.get(
  "/rex/:tokenId",
  createRexRoar
);

export default router;