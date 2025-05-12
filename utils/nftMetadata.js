import axios from "axios";
import { Contract } from "ethers";
import erc721Abi from "../contracts/LazyCubs.json" with { type: "json" };
import { ethProvider } from "../services/ethService.js";
import { downloadJsonFile, downloadJsonFileFromPinata } from "../utils/ipfsUtils.js";

export async function getNFTMetadata(tokenId, contractAddress, usePinataGateway = false) {
  const contract = new Contract(contractAddress, erc721Abi, ethProvider);

  try {
    // Get token URI from the contract
    const tokenURI = await contract.tokenURI(tokenId);

    // check if the tokenURI is an IPFS hash
    const isIpfs = tokenURI.startsWith("ipfs://");

    // Fetch the metadata from the IPFS hash
    if (isIpfs) {
      const ipfsHash = tokenURI.replace("ipfs://", "");
      const metadata = usePinataGateway
        ? await downloadJsonFileFromPinata(ipfsHash)
        : await downloadJsonFile(ipfsHash);
      return {
        tokenId: tokenId.toString(),
        metadata: metadata,
      };
    }

    // Fetch the metadata from the URI if it's not an IPFS hash
    const response = await axios.get(tokenURI);
    const metadata = response.data;

    return {
      tokenId: tokenId.toString(),
      metadata: metadata,
    };
  } catch (error) {
    console.error("Error in getTokenMetadata:", error);
    throw error;
  }
}

export async function getNFTData(address, contractAddress) {
  const contract = new Contract(contractAddress, erc721Abi, ethProvider);

    try {
      // Get balance
      const balance = await contract.balanceOf(address);
      const tokenIds = [];
  
      // Loop through tokens owned by the address
      for (let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i);
        tokenIds.push(tokenId.toString());
      }
  
      // Return only the array of token IDs
      return tokenIds;
    } catch (error) {
      console.error("Error in getTokenData:", error);
      throw error;
    }
  }
  

// Use the function with a specific address
// const address = '0x...'; // Replace with the actual address
// getTokenData(address)
//   .then(data => console.log(data))
//   .catch(error => console.error(error));
