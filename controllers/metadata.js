import s3, { GetObjectCommand } from "../services/s3Service.js";
import { ethProvider } from "../services/ethService.js";
import { Contract } from "ethers";

const METADATA_KEY = "public/metadata/";

export const getMetadata = async (req, res) => {
  const { id } = req.params;

  let tokenId = id.split(".")[0];

  if (!(await doesButtExist(tokenId))) {
    return res.status(400).json({ error: "This butt does not exist" });
  }

  let metadata;
  try {
    metadata = await getMetadataFromS3(`${METADATA_KEY}${id}`);
  } catch (error) {
    return res.status(401).json({ error: error });
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Disposition": "inline",
  });

  metadata.pipe(res);

  return;
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
