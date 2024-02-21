import express from "express";
import {
  createRexRoar,
  createValentine,
  createValentineCub,
  createGm,
  createCocoPride,
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

router.get(
  "/coco-pride/:tokenId",
  createCocoPride
);

export default router;