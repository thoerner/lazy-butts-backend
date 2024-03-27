import express from "express";
import {
  createRexRoar,
  createValentine,
  createValentineCub,
  createGm,
  createCocoPride,
  createSpringImage,
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

router.get(
  "/spring/:tokenId",
  createSpringImage
);

export default router;