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
} from "@thirdweb-dev/react";

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

const Home: NextPage = () => {
  return (
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
      <p className="text-xl text-muted-foreground">Add StopLoss to your NFTs</p>
      <div className="flex flex-row items-center gap-4 pt-6 pb-16 ">
        <ThirdwebProvider
          supportedWallets={supportedWallets}
          activeChain={CHAIN}
          clientId={process.env.NEXT_PUBLIC_THIRDWEB_API_KEY}
        >
          <ConnectWallet />
        </ThirdwebProvider>
      </div>

      <div className="flex flex-col w-full">
        <div className="flex flex-col items-start justify-start w-full md:w-96 pr-8">
          <h2 className="scroll-m-20 pb-2 text-3xl font-semibold tracking-tight transition-colors mt-2">
            My NFTs
          </h2>
          <p className="leading-7 my-2">
            Explore the features of EVM Kit below.
          </p>
        </div>
        <div
          className="border border-gray-700 rounded-lg flex-1 p-8 m-l-3 mt-4 lg:mt-0
          h-96 overflow-y-auto"
        >
          {/* NFTs here */}
        </div>
      </div>
    </div>
  );
};

export default Home;
