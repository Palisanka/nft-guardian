import type { NextPage } from "next";
import { Web3Button } from "@web3modal/react";
import { useEvmWalletNFTs } from "@moralisweb3/next";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { OpenSeaSDK, Chain } from "opensea-js";
import { EvmNft } from "moralis/common-evm-utils";
import { Seaport } from "@opensea/seaport-js";
import {
  ItemType,
  OPENSEA_CONDUIT_KEY,
  OrderType,
} from "@opensea/seaport-js/lib/constants";
import { generateRandomSalt } from "@opensea/seaport-js/lib/utils/order";
import SeaportABI from "../abi/seaport_1-5.json";
import {
  ConsiderationItem,
  OfferItem,
  Order,
  OrderComponents,
  OrderParameters,
} from "@opensea/seaport-js/lib/types";
import { CROSS_CHAIN_SEAPORT_V1_5_ADDRESS } from "@opensea/seaport-js/lib/constants";
import { createClient } from "@supabase/supabase-js";
import { useAccount } from "wagmi";

const sb_url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const sb_anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(sb_url, sb_anon);

let provider: ethers.providers.Web3Provider;
let openseaSDK: OpenSeaSDK;
let seaport: Seaport;
const SEAPORT_CONTRACT_ADDRESS = CROSS_CHAIN_SEAPORT_V1_5_ADDRESS;
const OPENSEA_FEE_RECIPIENT = "0x0000a26b00c1F0DF003000390027140000fAa719"; // TODO: find if exported somewhere else than seaport-gossip

const getCollectionDetails = async (collectionSlug: string) => {
  const collection = await openseaSDK.api.getCollection(collectionSlug);
  console.log("collection : ", collection);
  return collection;
};

const getNFTDetails = async (nft: any) => {
  const tokenAddress = nft.tokenAddress._value;
  const tokenId = nft.tokenId;
  const nftDetails = await openseaSDK.api.getNFT(
    Chain.Goerli,
    tokenAddress,
    tokenId,
    1
  );
  console.log("nftDetails : ", nftDetails.nft);
  return nftDetails.nft;
};

/**
 * Asks the user to sign an order.
 * (only for ETH tokens, only on OpenSea with 2.5% fees)
 *
 * @param {ethers.providers.Web3Provider} provider - The Web3 provider.
 * @param {string} address - The user's address.
 * @param {any} nft - The NFT to sell.
 * @param {number} targetFloorPrice - The target floor price.
 * @return {Promise<{ orderComponents: OrderComponents; signature: string }>} - An object containing the order components and the signature.
 */
async function askUserToSignOrder(
  provider: ethers.providers.Web3Provider,
  address: string,
  nft: any,
  targetFloorPrice: number
) {
  const offerer = address;
  const targetPrice = targetFloorPrice;
  const startTime = 0;
  const endTime = Math.round(Date.now() / 1000 + 60 * 60 * 24 * 30); // 30 days
  const salt = generateRandomSalt();
  const seaportContract = new ethers.Contract(
    SEAPORT_CONTRACT_ADDRESS,
    SeaportABI,
    provider.getSigner()
  );
  const counter = await seaportContract.getCounter(offerer);

  const offer: OfferItem[] = [
    {
      // NFT TO SELL
      itemType: ItemType.ERC721,
      token: nft.tokenAddress._value,
      identifierOrCriteria: nft.tokenId,
      startAmount: "1",
      endAmount: "1",
    },
  ];

  const considerationData: ConsiderationItem[] = [
    {
      // USER CONSIDERATION
      itemType: ItemType.NATIVE,
      token: ethers.constants.AddressZero,
      startAmount: ethers.utils.parseEther(targetPrice.toString()).toString(),
      endAmount: ethers.utils.parseEther(targetPrice.toString()).toString(),
      recipient: offerer,
      identifierOrCriteria: "0",
    },
    {
      // SEAPORT FEES
      itemType: ItemType.NATIVE,
      token: ethers.constants.AddressZero,
      identifierOrCriteria: "0",
      startAmount: ethers.utils
        .parseEther(((targetPrice * 2.5) / 100).toString())
        .toString(),
      endAmount: ethers.utils
        .parseEther(((targetPrice * 2.5) / 100).toString())
        .toString(),
      recipient: OPENSEA_FEE_RECIPIENT,
    },
  ];

  const orderParameters: OrderParameters = {
    offerer,
    zone: ethers.constants.AddressZero,
    offer,
    consideration: considerationData,
    orderType: OrderType.FULL_OPEN,
    totalOriginalConsiderationItems: considerationData.length,
    salt,
    startTime,
    endTime,
    zoneHash: ethers.constants.HashZero,
    conduitKey: OPENSEA_CONDUIT_KEY,
  };

  const orderComponents: OrderComponents = {
    ...orderParameters,
    counter: counter.toNumber(),
  };

  const signature = await seaport.signOrder(orderComponents);
  return { orderComponents, signature };
}

const Item = (evmNft: any) => {
  const [targetFloorPrice, setTargetFloorPrice] = useState(0);
  const { address } = useAccount();
  const nft = evmNft.nft._data;

  if (!nft || !address) {
    return null;
  }

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    const openSeaNft: any = await getNFTDetails(nft);
    const collectionSlug = openSeaNft.collection;
    const collection = await getCollectionDetails(collectionSlug);
    const floorPrice = collection.stats.floor_price;
    if (floorPrice < targetFloorPrice) {
      throw new Error("Target floor price must be less than the current price");
    } else {
      const {
        orderComponents,
        signature,
      }: {
        orderComponents: OrderComponents;
        signature: string;
      } = await askUserToSignOrder(provider, address, nft, targetFloorPrice);

      const order: Order = {
        parameters: orderComponents,
        signature,
      };

      console.log("order", order);

      const { data, error } = await supabase
        .from("sl_order")
        .insert([
          {
            order,
            collection_slug: collectionSlug,
            target_floor_price: targetFloorPrice,
          },
        ])
        .select();
      if (error) throw error;
      console.log("data", data);

      // TODO: add user management with rls + link an order to an eth address + remove the public insert on rls
      // TODO: encrypt sigature
      // TODO: basic error handling
      // TODO: handle types
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
      <form onSubmit={(e) => handleSubmit(e)} className="flex w-full mt-4">
        <input
          id={`floorValue-${nft.tokenId}-${nft.name}`}
          name="floorValue"
          type="string"
          className="border-2 border-gray-300 p-4 border-opacity-20 text-black w-3/5"
          value={targetFloorPrice}
          onChange={(e) => {
            // @ts-ignore
            setTargetFloorPrice(e.target.value);
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
  const { address } = useAccount();
  const nfts: EvmNft[] | undefined = useEvmWalletNFTs({
    address: address || "",
    chain: "0x5", // TODO: make dynamic
  }).data;

  useEffect(() => {
    provider = new ethers.providers.Web3Provider(
      // @ts-ignore
      window.ethereum,
      Chain.Goerli
    );
    openseaSDK = new OpenSeaSDK(provider, {
      chain: Chain.Goerli,
      // apiKey: "", // only needed for mainnet
    });
    seaport = new Seaport(provider);
  }, []);

  return (
    <div>
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
        <p className="text-xl text-muted-foreground mb-4">
          Add StopLoss to your NFTs
        </p>
        <Web3Button />
        <div className="flex flex-row items-center gap-4 pt-6 pb-16 "></div>

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
                nfts?.map((nft: any) => {
                  if (nft.metadata?.image)
                    return <Item key={nft.tokenId} nft={nft} />;
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
    </div>
  );
};

export default Home;
