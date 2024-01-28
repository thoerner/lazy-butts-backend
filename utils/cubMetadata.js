import axios from "axios";
import { Contract } from "ethers";
import lazyCubsAbi from "../contracts/LazyCubs.json" assert { type: "json" };
import provider from "../services/ethService.js";

const contractAddress = '0xE6A9826E3B6638d01dE95B55690bd4EE7EfF9441';
const contract = new Contract(contractAddress, lazyCubsAbi, provider);

export async function getTokenMetadata(tokenId) {
  try {
      // Get token URI from the contract
      const tokenURI = await contract.tokenURI(tokenId);
      
      // Fetch the metadata from the URI
      const response = await axios.get(tokenURI);
      const metadata = response.data;
      
      return {
          tokenId: tokenId.toString(),
          metadata: metadata
      };

  } catch (error) {
      console.error('Error in getTokenMetadata:', error);
      throw error;
  }
}


export async function getTokenData(address) {
  try {
      // Get balance
      const balance = await contract.balanceOf(address);
      const tokenIds = [];
      const tokenURIs = [];

      // Loop through tokens owned by the address
      for (let i = 0; i < balance; i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(address, i);
          tokenIds.push(tokenId.toString());
          const tokenURI = await contract.tokenURI(tokenId);
          tokenURIs.push(tokenURI);
      }

      // Fetch JSON metadata from token URIs
      const metadataPromises = tokenURIs.map(async (uri) => {
          const response = await axios.get(uri);
          return response.data;
      });

      const metadata = await Promise.all(metadataPromises);
      
      // Combine token IDs with their corresponding metadata
      const tokensData = tokenIds.map((id, index) => ({
          tokenId: id,
          metadata: metadata[index]
      }));
      
      return tokensData;

  } catch (error) {
      console.error('Error in getTokenData:', error);
      throw error;
  }
}

// Use the function with a specific address
// const address = '0x...'; // Replace with the actual address
// getTokenData(address)
//   .then(data => console.log(data))
//   .catch(error => console.error(error));