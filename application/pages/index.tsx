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

import { Fragment } from "react";
import { Transition } from "@headlessui/react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/20/solid";

const Notification = ({ ...props }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (props.message) {
      setShow(true);
      setTimeout(() => {
        setShow(false);
      }, 4000);
    }
  }, [props.message]);

  return (
    <>
      {/* Global notification live region, render this permanently at the end of the document */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition
            show={show}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {/* <CheckCircleIcon
                      className="h-6 w-6 text-green-400"
                      aria-hidden="true"
                    /> */}
                    <ExclamationCircleIcon
                      className="h-6 w-6 text-red-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {props.message}
                    </p>
                    {/* <p className="mt-1 text-sm text-gray-500">
                      Anyone with a link can now view this file.
                    </p> */}
                  </div>
                  <div className="ml-4 flex flex-shrink-0">
                    <button
                      type="button"
                      className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => {
                        setShow(false);
                        props.message = null;
                      }}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
  );
};

const sb_url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const sb_anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(sb_url, sb_anon);

let provider: ethers.providers.Web3Provider;
let openseaSDK: OpenSeaSDK;
let seaport: Seaport;
const SEAPORT_CONTRACT_ADDRESS = CROSS_CHAIN_SEAPORT_V1_5_ADDRESS;
const OPENSEA_FEE_RECIPIENT = "0x0000a26b00c1F0DF003000390027140000fAa719"; // TODO: find if exported somewhere else than seaport-gossip

const handleError = (error: any) => {
  console.error(error);
  throw error;
};

const getNFTDetails = async (nft: any) => {
  if (!openseaSDK || !nft) {
    return null;
  }
  const tokenAddress = nft.tokenAddress._value;
  const tokenId = nft.tokenId;
  try {
    const nftDetails = await openseaSDK.api.getNFT(
      Chain.Goerli,
      tokenAddress,
      tokenId,
      1
    );
    return nftDetails.nft;
  } catch (error) {
    handleError(error);
  }
};

const getCollectionDetails: any = async (nft: any) => {
  if (!openseaSDK || !nft) {
    return null;
  }
  try {
    const openSeaNft: any = await getNFTDetails(nft);
    const collectionSlug = openSeaNft.collection;
    const collection = await openseaSDK.api.getCollection(collectionSlug);
    return collection;
  } catch (error) {
    handleError(error);
  }
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
  let counter;
  try {
    counter = await seaportContract.getCounter(offerer);
  } catch (error) {
    handleError(error);
  }

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

  try {
    const signature = await seaport.signOrder(orderComponents);
    return { orderComponents, signature };
  } catch (error) {
    handleError(error);
  }
}

const Item = (evmNft: any) => {
  const [targetFloorPrice, setTargetFloorPrice] = useState(0);
  const [error, setError] = useState<string>("");
  const { address } = useAccount();
  const nft = evmNft.nft._data;

  if (!nft || !address) {
    return null;
  }

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    const collection = await getCollectionDetails(nft);
    const floorPrice = collection.stats.floor_price;

    if (floorPrice < targetFloorPrice) {
      setError(
        `Target floor price must be less than the current floor price, it's actually ${floorPrice}eth`
      );
      // throw new Error("Target floor price must be less than the current price");
    } else {
      setError("");
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
      const { data, error: sbError } = await supabase
        .from("sl_order")
        .insert([
          {
            order,
            collection_slug: collection.slug,
            target_floor_price: targetFloorPrice,
          },
        ])
        .select();
      if (sbError) throw sbError;
      console.log("data", data);

      // TODO: handle handle opensea fees address in the collection object
      // TODO: add user management with rls + link an order to an eth address + remove the public insert on rls
      // TODO: encrypt sigature
      // TODO: basic error handling
      // TODO: handle types
    }
  };
  return (
    <div
      key={`floorValue-${nft.tokenId}-${nft.name}-${nft.tokenUri}`}
      className="flex flex-col mb-8 rounded-2xl shadow-lg bg-white mr-6"
    >
      <Notification message={error} />
      <section className="flex flex-col items-center px-3 py-4">
        <div className="w-full">
          <div className="w-full">
            <span className="text-xl font-semibold tracking-tight transition-colors">
              {nft.name}
            </span>
          </div>
          <span className=" tracking-tight transition-colors w-full">
            #{nft.tokenId}
          </span>
        </div>
        <img
          src={nft.metadata?.image}
          alt={nft.name}
          className="rounded-full w-2/3"
        />
      </section>
      <section>
        <hr className="w-full border-slate-300 border-t-1 my-2 mt-4" />
        {/* <div>
          <span>Floor</span>
          <div>
            <span>{floorPrice}</span>
            <span>eth</span>
          </div>
        </div> */}
        <form onSubmit={(e) => handleSubmit(e)} className="mt-4">
          <div className="w-full my-2 pb-4">
            <input
              id={`floorValue-${nft.tokenId}-${nft.name}`}
              name="floorValue"
              type="string"
              className="border-2 border-gray-300 p-4 border-opacity-20 text-black w-3/5 focus:outline-none focus:border-slate-700 h-[99%]"
              value={targetFloorPrice}
              onChange={(e) => {
                // @ts-ignore
                setTargetFloorPrice(e.target.value);
              }}
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-400 p-4 w-2/5 text-white"
            >
              Add a SL
            </button>
          </div>
          {/* <button className="bg-slate-800 hover:bg-slate-400 font-semibold p-4 w-full text-white rounded-b-2xl">
            Close
          </button> */}
          {/* <button className="bg-slate-800 hover:bg-slate-400 font-semibold p-4 w-full text-white rounded-b-2xl">
            Add order
          </button> */}
        </form>
      </section>
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
      <div className="w-full mx-auto pr-8 pl-8 max-w-7xl relative pt-32 bg-slate-100">
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

        <div className="flex flex-col w-full mt-16">
          <div className="rounded-lg p-8 m-l-3 mt-4 lg:mt-0 flex flex-wrap justify-center">
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
