import s3, { GetObjectCommand } from "../services/s3Service.js";
import { ethProvider } from "../services/ethService.js";
import { Contract } from "ethers";

const METADATA_KEY = "public/metadata/";

export const getMetadataFunction = async (tokenId) => {
  if (!(await doesButtExist(tokenId))) {
    return { error: "This butt does not exist" };
  }

  try {
    const response = await getMetadataFromS3(`${METADATA_KEY}${tokenId}.json`);

    return new Promise((resolve, reject) => {
      let rawData = "";
      response.on("data", (chunk) => {
        rawData += chunk;
      });
      response.on("end", () => {
        try {
          const metadata = JSON.parse(rawData);
          resolve(metadata);
        } catch (e) {
          reject({ error: "Failed to parse JSON" });
        }
      });
    });
  } catch (error) {
    return {
      error: error.message || "An error occurred while fetching metadata",
    };
  }
};

export const getMetadata = async (req, res) => {
  const { id } = req.params;
  let tokenID = id.split(".")[0]; // Assuming the token ID is the part of the request parameter before any '.'

  try {
    const metadata = await getMetadataFunction(tokenID);
    if (metadata.error) {
      // If metadata function returned an error, send it with a 400 status code
      return res.status(400).json({ error: metadata.error });
    }

    // If everything went well, send the metadata with a 200 status code
    res.status(200).json(metadata);
  } catch (error) {
    // If there was an error calling getMetadataFunction, log it and return a 500 status
    console.error("An error occurred:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching metadata" });
  }
};

async function getMetadataFromS3(key) {
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
