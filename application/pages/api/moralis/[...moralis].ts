import { MoralisNextApi } from "@moralisweb3/next";

console.log("MoralisNextApi : ", process.env.MORALIS_API_KEY || "");
export default MoralisNextApi({ apiKey: process.env.MORALIS_API_KEY || "" });
