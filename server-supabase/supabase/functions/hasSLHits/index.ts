// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenSeaSDK, Chain } from "https://esm.sh/opensea-js@6.1.9";
import { ethers } from "https://esm.sh/ethers@5.7.2";
import { Order } from "https://esm.sh/@opensea/seaport-js/lib/types";
import { CROSS_CHAIN_SEAPORT_V1_5_ADDRESS } from "https://esm.sh/@opensea/seaport-js/lib/constants";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Hello from the edge function !");
const provider = new ethers.providers.JsonRpcProvider("");
let supabaseClient;
const openseaSDK: OpenSeaSDK = new OpenSeaSDK(provider, {
  chain: Chain.Goerli,
  apiKey: "", // not needed on testnet
});

/**
 * Fulfill an order using a signature (without signing provider) and returns the response.
 *
 * @param {Order} order - The order to be fulfilled.
 * @param {Chain} chain - The chain on which to fulfill the order. Defaults to Goerli.
 * @return {Promise<any>} A promise that resolves to the response of the API call.
 */
async function fulfillOrder(
  id: string,
  order: Order,
  chain: Chain = Chain.Goerli
) {
  const isTestnetChain = chain === Chain.Goerli || chain === Chain.Sepolia;
  const baseApiUrl = isTestnetChain
    ? "https://testnets-api.opensea.io/v2/orders"
    : "https://api.opensea.io/v2/orders";

  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      parameters: {
        ...order.parameters,
      },
      signature: order.signature,
      protocol_address: CROSS_CHAIN_SEAPORT_V1_5_ADDRESS,
    }),
  };

  fetch(`${baseApiUrl}/${chain}/seaport/listings`, options)
    .then((response) => response.json())
    .then((response) => {
      setOrderAsExecuted(id, order);
      return response;
    })
    .catch((err) => {
      console.error(err);
      return err;
    });
}

async function setOrderAsExecuted(id: string, order: Order) {
  const { error } = await supabaseClient
    .from("sl_order")
    .update({ executed: "TRUE" })
    .eq("id", id);
  if (error) {
    throw error;
  }
}

const hasSLHits = async (collectionSlug: string, targetPrice: number) => {
  const collection = await openseaSDK.api.getCollection(collectionSlug);
  const floorPrice = collection.stats.floor_price;
  const hasSLHits = floorPrice < targetPrice;
  return hasSLHits;
};

const executeOrders = async (order) => {};

serve(async (req) => {
  supabaseClient = createClient("", ""); // Fill it with your supabase url and anon key
  console.log(Deno.env.get("SUPABASE_URL"));
  console.log(Deno.env.get("SUPABASE_ANON_KEY"));

  // TODO: add rls to not have the read public
  const { data: slOrders, error } = await supabaseClient
    .from("sl_order")
    .select("*")
    .eq("executed", "FALSE");

  if (!slOrders) {
    return new Response("No orders to execute", {
      headers: { "Content-Type": "application/json" },
    });
  }

  let executedOrders: Order[] = [];
  slOrders.forEach(async (slOrder) => {
    const {
      collection_slug: collectionSlug,
      target_floor_price: targetFloorPrice,
    } = slOrder;

    const hasSLHitsValue = await hasSLHits(collectionSlug, targetFloorPrice);
    console.log("hasSLHitsValue : ", hasSLHitsValue);
    if (hasSLHitsValue) {
      try {
        fulfillOrder(slOrder.id, slOrder.order, Chain.Goerli);
        executedOrders.push(slOrder);
        console.log("nb of executed orders : ", executedOrders.length);
      } catch (err) {
        throw err;
      }
    }
  });

  const data = {
    message: `${executedOrders.length} orders has beeen executed`,
    executedOrders: JSON.stringify(executedOrders),
  };

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
