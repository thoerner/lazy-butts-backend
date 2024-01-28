import axios from "axios";
import { Contract } from "ethers";
import lazyCubsAbi from "../contracts/LazyCubs.json" assert { type: "json" };
import { ethProvider } from "../services/ethService.js";

const contractAddress = "0xE6A9826E3B6638d01dE95B55690bd4EE7EfF9441";
const contract = new Contract(contractAddress, lazyCubsAbi, ethProvider);

export async function getTokenMetadata(tokenId) {
  try {
    // Get token URI from the contract
    const tokenURI = await contract.tokenURI(tokenId);

    // Fetch the metadata from the URI
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

export async function getTokenData(address) {
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
