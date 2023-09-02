import type { NextPage } from "next";
import { CHAIN } from "../const/chains";
import { OpenSeaSDK, Chain } from "opensea-js";
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
  useConnectionStatus,
} from "@thirdweb-dev/react";
import { useEvmWalletNFTs } from "@moralisweb3/next";
import { useEffect, useState } from "react";

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

const Item = (evmNft: any) => {
  const [floorValue, setFloorValue] = useState(0);
  const nft = evmNft.nft;

  const handleSubmit = (event: any) => {
    event.preventDefault();
    console.log(floorValue);
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
      <form onSubmit={handleSubmit} className="flex w-full mt-4">
        <input
          id={`floorValue-${nft.tokenId}-${nft.name}`}
          name="floorValue"
          type="string"
          className="border-2 border-gray-300 p-4 border-opacity-20 text-black w-3/5"
          value={floorValue}
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
  const nfts = useEvmWalletNFTs({
    address: address || "",
    chain: "0x5", // TODO: make dynamic
  }).data;

  useEffect(() => {
    console.log("Address changed:", address); // not working -> use address or config failed
  }, [address]);

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
