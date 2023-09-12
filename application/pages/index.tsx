import type { NextPage } from "next";
import { CHAIN } from "../const/chains";
import {
  ConnectWallet,
  ThirdwebProvider,
  coinbaseWallet,
  localWallet,
  magicLink,
  metamaskWallet,
  safeWallet,
  walletConnect,
  useAddress,
  useWallet,
} from "@thirdweb-dev/react";
import { useEvmWalletNFTs } from "@moralisweb3/next";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { OpenSeaSDK, Chain } from "opensea-js";
import { EvmNft } from "moralis/common-evm-utils";

const supportedWallets = [
  metamaskWallet(),
  coinbaseWallet(),
  walletConnect(),
  localWallet(),
  safeWallet(),
  magicLink({
    apiKey: process.env.NEXT_PUBLIC_MAGIC_LINK_API_KEY as string,
  }),
];

let provider: ethers.providers.Web3Provider;
let openseaSDK: OpenSeaSDK;

const getNFTDetails = async (nft: any) => {
  const tokenAddress = nft.tokenAddress._value;
  const tokenId = nft.tokenId;
  const nftDetails = await openseaSDK.api.getNFT(
    Chain.Goerli,
    tokenAddress,
    tokenId,
    1
  );
  console.log("nftDetails : ", nftDetails);
  return nftDetails;
};

const addListing = async (nft: any, accountAddress: string, price: number) => {
  const tokenAddress = nft.tokenAddress._value;
  const tokenId = nft.tokenId;

  try {
    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24);
    const listing = await openseaSDK.createSellOrder({
      asset: {
        tokenId,
        tokenAddress,
      },
      accountAddress: accountAddress || "0x",
      startAmount: price,
      expirationTime,
    });
    console.log("listing : ", listing);
    return listing;
  } catch (error) {
    console.log(error);
  }
};

const Item = (evmNft: any) => {
  const [askedFloorPrice, setFloorValue] = useState(0);
  const address = useAddress() || "";
  const nft = evmNft.nft._data;

  const handleSubmit = (event: any) => {
    event.preventDefault();
    const floorPrice = 1; // TODO: get floor price
    console.log(nft);
    // getNFTDetails(nft);
    if (floorPrice > askedFloorPrice) {
      throw new Error("Floor price must be less than the current price");
    } else {
      // TODO : start cron job / oracle to check for price updates
      addListing(nft, address, askedFloorPrice); // TODO: get authorisation without listing rn (add listingTime to list later and then cancel order if needed)
    }
  };
  return (
    <div
      key={`floorValue-${nft.tokenId}-${nft.name}-${nft.tokenUri}`}
      className="flex flex-col items-start justify-start w-full md:w-1/3 sm:w-1/2 pr-8 mb-8 border-2 p-2 rounded-lg border-white"
    >
      <a
        href={nft.tokenUri}
        className="text-lg font-semibold tracking-tight transition-colors"
      >
        {nft.name} - {nft.tokenId}
      </a>
      <img src={nft.metadata?.image} alt={nft.name} className="rounded-lg" />
      <form onSubmit={(e) => handleSubmit(e, nft)} className="flex w-full mt-4">
        <input
          id={`floorValue-${nft.tokenId}-${nft.name}`}
          name="floorValue"
          type="string"
          className="border-2 border-gray-300 p-4 border-opacity-20 text-black w-3/5"
          value={askedFloorPrice}
          onChange={(e) => {
            setFloorValue(e.target.value);
          }}
        />
        <button
          type="submit"
          className="bg-white p-4 w-2/5 text-black hover:bg-slate-300"
        >
          Add a SL
        </button>
      </form>
    </div>
  );
};

const Home: NextPage = () => {
  const address = useAddress();
  const wallet = useWallet();
  const nfts: EvmNft[] | undefined = useEvmWalletNFTs({
    address: address || "",
    chain: "0x5", // TODO: make dynamic
  }).data;

  useEffect(() => {
    provider = new ethers.providers.Web3Provider(
      window.ethereum as any,
      Chain.Goerli
    );
    openseaSDK = new OpenSeaSDK(provider, {
      chain: Chain.Goerli,
      // apiKey: "", // only needed for mainnet
    });
  }, []);

  useEffect(() => {
    console.log("Address changed:", address); // not working -> use address or config failed
  }, [address]);

  useEffect(() => {
    console.log("wallet changed:", wallet); // not working too
  }, [wallet]);

  return (
    <ThirdwebProvider
      supportedWallets={supportedWallets}
      activeChain={CHAIN}
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_API_KEY}
    >
      <div className="w-full mx-auto pr-8 pl-8 max-w-7xl relative pb-10 mt-32">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          NFT Guardian{" "}
          <span
            className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4
        text-gray-400
        "
          >
            {/* add StopLoss to your NFTs */}
          </span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Add StopLoss to your NFTs
        </p>
        <div className="flex flex-row items-center gap-4 pt-6 pb-16 ">
          <ConnectWallet />
        </div>

        <div className="flex flex-col w-full">
          <div className="flex flex-col items-start justify-start w-full md:w-96 pr-8">
            <h2 className="scroll-m-20 pb-2 text-3xl font-semibold tracking-tight transition-colors mt-2">
              My NFTs
            </h2>
          </div>
          <div
            className="border border-gray-700 rounded-lg flex-1 p-8 m-l-3 mt-4 lg:mt-0
          h-96 overflow-y-auto flex flex-wrap"
          >
            {!!nfts ? (
              nfts.length === 0 ? (
                <p className="leading-7 my-2">You don't have any NFTs yet.</p>
              ) : (
                nfts?.map((nft) => {
                  if (nft.metadata?.image) return <Item nft={nft} />;
                })
              )
            ) : (
              <p className="leading-7 my-2">
                Connect your wallet to see your NFTs.
              </p>
            )}
          </div>
        </div>
      </div>
    </ThirdwebProvider>
  );
};

export default Home;
