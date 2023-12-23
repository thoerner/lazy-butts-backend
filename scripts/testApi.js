import axios from "axios";

const main = async (tokenId) => {
  // create images
  try {
    const response = await axios({
      method: "post",
      url: `https://api.the3dkings.io/api/create/transparent/${tokenId}`,
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.status === 200) {
      console.log(`Successfully created images for token ${tokenId}`);
    } else {
      console.error(`Error creating images for token ${tokenId}`);
    }
  } catch (err) {
    console.error(`Error creating images: ${err}`);
  }
};

main(2);