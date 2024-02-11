import { verifySessionAuth } from "../utils/authTools.js";
import s3, { GetObjectCommand } from "../services/s3Service.js";
import db, { GetItemCommand } from "../services/dbService.js";
import { downloadFile } from "../utils/ipfsUtils.js";
import { getTokenMetadata } from "../utils/cubMetadata.js";
import { ethProvider } from "../services/ethService.js";
import { Contract } from "ethers";

const BUTT_KEY = "public/images/butts/";
const FULL_BODY_KEY = "public/images/full-lions/";
const SOCIAL_KEY = "public/images/social-lions/";
const SEASONAL_KEY = "public/images/seasonal/";
const FULL_BODY_THUMB_KEY = "public/images/small-full-lions/";
const SMALL_BUTT_KEY = "public/images/small-lazy-butts/";
const MEDIUM_BUTT_KEY = "public/images/medium-lazy-butts/";
const TRANSPARENT_KEY = "public/images/full-transparent/";

export const getCubImage = async (req, res) => {
  const { tokenId } = req.params;

  let tokenMetadata;
  try {
    tokenMetadata = await getTokenMetadata(tokenId);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(400).json({ error: error });
  }

  const imageCid = tokenMetadata.metadata.image.split("ipfs://")[1];

  try {
    const image = await downloadFile(imageCid);
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(image, "binary");
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(400).json({ error: error });
  }
};

export const getButt = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${BUTT_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

export const getSmallButt = async (req, res) => {
  const { imageName } = req.params;

  let tokenID = imageName.split(".")[0];

  if (!(await doesButtExist(tokenID))) {
    return res
      .status(401)
      .json({ error: "You are not authorized to view this image" });
  }

  let image;
  try {
    image = await getImageFromS3(`${SMALL_BUTT_KEY}${imageName}`);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }

  res.writeHead(200, { "Content-Type": "image/png" });

  image.pipe(res);

  return;
};

export const getMediumButt = async (req, res) => {
  const { imageName } = req.params;

  let tokenID = imageName.split(".")[0];

  if (!(await doesButtExist(tokenID))) {
    return res
      .status(401)
      .json({ error: "You are not authorized to view this image" });
  }

  let image;
  try {
    image = await getImageFromS3(`${MEDIUM_BUTT_KEY}${imageName}`);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }

  res.writeHead(200, { "Content-Type": "image/png" });

  image.pipe(res);

  return;
};

async function getImageFromS3(key) {
  const params = {
    Bucket: "lazybutts",
    Key: key,
  };
  const command = new GetObjectCommand(params);
  try {
    const data = await s3.send(command);
    return data.Body;
  } catch (error) {
    console.log("Caught an error:", error);
    throw new Error(error);
  }
}

export const getFullBody = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${FULL_BODY_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

export const getTransparent = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${TRANSPARENT_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

export const getSocial = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${SOCIAL_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

export const getSeasonal = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${SEASONAL_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

export const getFullBodyThumb = async (req, res) => {
  const { imageName } = req.params;
  const { authorization, address } = req.headers;

  try {
    await verifySessionAuth(address, authorization);
    await authorizeButtAccess(address, imageName);
    getAndReturnImageFromS3(`${FULL_BODY_THUMB_KEY}${imageName}`, res);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(401).json({ error: error });
  }
};

async function checkButtsOwnership(address) {
  const params = {
    TableName: "users",
    Key: {
      address: {
        S: address,
      },
    },
  };

  let buttsArray = [];
  try {
    const data = await db.send(new GetItemCommand(params));
    buttsArray = data.Item.butts.L.map((butt) => butt.N);
  } catch (err) {
    console.error("An error occurred:", err);
    return [];
  }

  return buttsArray;
}

async function getAndReturnImageFromS3(key, res) {
  // <-- 'res' added as parameter
  const params = {
    Bucket: "lazybutts",
    Key: key,
  };
  const command = new GetObjectCommand(params);
  try {
    const data = await s3.send(command);
    res.writeHead(200, { "Content-Type": data.ContentType });
    data.Body.pipe(res); // Piping the data directly to the response
  } catch (error) {
    console.log("An error occurred:", error);
    return res.status(400).json({ error: error });
  }
}

async function doesButtExist(tokenID) {
  const contract = new Contract(
    process.env.BUTTS_CONTRACT_ADDRESS,
    ["function tokenURI(uint256 tokenId) view returns (string)"],
    ethProvider
  );

  // check if token is minted by checking if tokenURI exists or returns an error
  try {
    const tokenURI = await contract.tokenURI(tokenID);
    if (tokenURI === "") {
      return false;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return false;
  }

  return true;
}

async function authorizeButtAccess(address, imageName) {
  const imageNamePrefix = imageName.split(".")[0];
  const buttsArray = await checkButtsOwnership(address);
  if (!buttsArray.includes(imageNamePrefix)) {
    throw new Error("You don't own this butt");
  }
}
