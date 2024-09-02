import express from "express";
import {
  createRexRoar,
  createValentine,
  createValentineCub,
  createGm,
  createCubGm,
  createZiaImage,
  createCocoPride,
  createSpringImage,
  createCustomImage,
  createSummerVideo,
} from "../controllers/create.js";

const router = express.Router();

router.post(
  "/custom",
  createCustomImage
);

router.get(
  "/gm/:tokenId",
  createGm
);

router.get(
  "/gm/cub/:tokenId",
  createCubGm
);

router.get(
  "/zia/:soda/:tokenId",
  createZiaImage
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

router.get(
  "/summer/:tokenId",
  createSummerVideo
);

export default router;