import express from "express";
import {
  createRexRoar,
  createValentine,
  createValentineCub,
  createGm,
} from "../controllers/create.js";

const router = express.Router();

router.get(
  "/gm/:tokenId",
  createGm
);

router.get(
  "/valentine/:tokenId",
  createValentine
);

router.get(
  "/valentine/cub/:tokenId",
  createValentineCub
);

router.get(
  "/rex/:tokenId",
  createRexRoar
);

export default router;