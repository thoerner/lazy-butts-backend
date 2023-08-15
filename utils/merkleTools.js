import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export const makeTree = (addresses) => {
  const leafNodes = addresses.map(addr => keccak256(addr));
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  return merkleTree;
}

export const getRoot = (merkleTree) => {
  return "0x" + merkleTree.getRoot().toString("hex");
}

export const getProof = (merkleTree, claimingAddress) => {
  const claimingNode = keccak256(claimingAddress); 
  const hexProof = merkleTree.getHexProof(claimingNode);
  if (!hexProof[0]) {
    return {
      success: false,
      error: "Error: Address not on allow list!"
    }
  }
  return {
    success: true,
    data: hexProof
  }
}