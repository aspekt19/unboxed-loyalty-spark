/**
 * Shared P2P marketplace DB intents (offers list/create/accept/cancel).
 * Used by agent-api (merchant lsk_, creator = ownerAddress) and recipient-api (buyer rwk_, creator = bound wallet).
 */
import { appendBuilderCode, BUILDER_CODE } from "./loyalspark-agent-helpers.ts";

export type JsonBody = Record<string, unknown>;

export type ServiceResult = { status: number; body: JsonBody };

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/** Escrow contract on Base — see contracts/LoyaltyTokenEscrow.sol */
export const ESCROW_ADDRESS = "0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF";

/** Selectors for LoyaltyTokenEscrow */
const ESCROW_SELECTORS = {
  // createOffer(address,uint256,address,uint256)
  createOffer: "0a8e8e01",
  // fillOffer(uint256)
  fillOffer: "ca1d209d",
  // cancelOffer(uint256)
  cancelOffer: "ef706adf",
  // approve(address,uint256) on ERC-20
  approve: "095ea7b3",
};

function pad64(hexNo0x: string): string {
  return hexNo0x.toLowerCase().padStart(64, "0");
}

function addrTo32(addr: string): string {
  return pad64(addr.replace(/^0x/, ""));
}

function uintTo32(value: number | string | bigint): string {
  const big = typeof value === "bigint" ? value : BigInt(value as any);
  return pad64(big.toString(16));
}

/** ERC-20 amount in 18 decimals (loyalty tokens use 18 decimals). */
function amountWei18(amount: number): bigint {
  return BigInt(Math.floor(Number(amount) * 1e18));
}

export function encodeEscrowApproveCalldata(amount: number): string {
  const sel = "0x" + ESCROW_SELECTORS.approve;
  const data = sel + addrTo32(ESCROW_ADDRESS) + uintTo32(amountWei18(amount));
  return appendBuilderCode(data);
}

export function encodeEscrowCreateOfferCalldata(
  offerToken: string,
  offerAmount: number,
  requestToken: string,
  requestAmount: number,
): string {
  const sel = "0x" + ESCROW_SELECTORS.createOffer;
  const data =
    sel +
    addrTo32(offerToken) +
    uintTo32(amountWei18(offerAmount)) +
    addrTo32(requestToken) +
    uintTo32(amountWei18(requestAmount));
  return appendBuilderCode(data);
}

export function encodeEscrowFillOfferCalldata(onchainOfferId: number | string | bigint): string {
  const sel = "0x" + ESCROW_SELECTORS.fillOffer;
  return appendBuilderCode(sel + uintTo32(onchainOfferId));
}

export function encodeEscrowCancelOfferCalldata(onchainOfferId: number | string | bigint): string {
  const sel = "0x" + ESCROW_SELECTORS.cancelOffer;
  return appendBuilderCode(sel + uintTo32(onchainOfferId));
}

export async function marketplaceListOffers(
  serviceClient: { from: (t: string) => any },
  tokenAddress: string | null
): Promise<ServiceResult> {
  let query = serviceClient
    .from("marketplace_offers")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (tokenAddress && ADDR.test(tokenAddress)) {
    const ta = tokenAddress.toLowerCase();
    query = query.or(`offer_token_address.eq.${ta},request_token_address.eq.${ta}`);
  }

  const { data: offers, error } = await query;
  if (error) {
    return { status: 500, body: { error: "Failed to fetch offers" } };
  }
  return { status: 200, body: { offers: offers || [] } };
}

export async function marketplaceCreateOffer(
  serviceClient: { from: (t: string) => any },
  creatorAddress: string,
  body: JsonBody
): Promise<ServiceResult> {
  const w = creatorAddress.toLowerCase();
  const { offer_token_address, offer_amount, request_token_address, request_amount } = body;

  if (!offer_token_address || !offer_amount || !request_token_address || !request_amount) {
    return {
      status: 400,
      body: { error: "Missing fields: offer_token_address, offer_amount, request_token_address, request_amount" },
    };
  }

  if (!ADDR.test(String(offer_token_address)) || !ADDR.test(String(request_token_address))) {
    return { status: 400, body: { error: "Invalid token address format" } };
  }

  const ota = String(offer_token_address).toLowerCase();
  const rta = String(request_token_address).toLowerCase();
  if (ota === rta) {
    return { status: 400, body: { error: "Cannot exchange same tokens" } };
  }

  if (
    typeof offer_amount !== "number" ||
    offer_amount <= 0 ||
    typeof request_amount !== "number" ||
    request_amount <= 0
  ) {
    return { status: 400, body: { error: "Amounts must be positive numbers" } };
  }

  const { data: offer, error } = await serviceClient
    .from("marketplace_offers")
    .insert({
      creator_address: w,
      offer_token_address: ota,
      offer_amount,
      request_token_address: rta,
      request_amount,
      status: "active",
    })
    .select("id, offer_token_address, offer_amount, request_token_address, request_amount, status, created_at")
    .single();

  if (error) {
    return { status: 500, body: { error: "Failed to create offer" } };
  }

  return {
    status: 201,
    body: {
      offer,
      message: "Offer recorded. To secure with escrow, approve and call createOffer on the escrow contract.",
      escrow_contract: {
        address: ESCROW_ADDRESS,
        function: "createOffer(address,uint256,address,uint256)",
        params: [ota, offer_amount, rta, request_amount],
        note: "First approve the escrow contract for offer_amount of offer_token, then call createOffer.",
        builder_code: BUILDER_CODE,
        calldata: {
          approve: {
            to: ota,
            data: encodeEscrowApproveCalldata(Number(offer_amount)),
            description: "ERC-20 approve(escrow, offer_amount) on offer_token",
          },
          create_offer: {
            to: ESCROW_ADDRESS,
            data: encodeEscrowCreateOfferCalldata(ota, Number(offer_amount), rta, Number(request_amount)),
            description: "createOffer on escrow with Builder Code suffix",
          },
        },
      },
    },
  };
}

export async function marketplaceAcceptOffer(
  serviceClient: { from: (t: string) => any },
  acceptorAddress: string,
  body: JsonBody
): Promise<ServiceResult> {
  const w = acceptorAddress.toLowerCase();
  const { offer_id, onchain_offer_id, request_token_address, request_amount } = body as {
    offer_id?: string;
    onchain_offer_id?: number | string;
    request_token_address?: string;
    request_amount?: number;
  };
  if (!offer_id) {
    return { status: 400, body: { error: "Missing field: offer_id" } };
  }

  const { data: offer, error } = await serviceClient
    .from("marketplace_offers")
    .select("*")
    .eq("id", offer_id)
    .eq("status", "active")
    .single();

  if (error || !offer) {
    return { status: 404, body: { error: "Offer not found or already completed" } };
  }

  if (String(offer.creator_address).toLowerCase() === w) {
    return { status: 400, body: { error: "Cannot accept your own offer" } };
  }

  await serviceClient
    .from("marketplace_offers")
    .update({
      status: "completed",
      completed_by: w,
      completed_at: new Date().toISOString(),
    })
    .eq("id", offer_id);

  const reqToken = (request_token_address ?? offer.request_token_address) as string;
  const reqAmount = Number(request_amount ?? offer.request_amount);
  const fillCalldata =
    onchain_offer_id !== undefined && onchain_offer_id !== null
      ? encodeEscrowFillOfferCalldata(onchain_offer_id as number | string)
      : null;

  return {
    status: 200,
    body: {
      message: "Offer accepted. Execute fillOffer on the escrow contract to complete the atomic swap.",
      escrow_contract: {
        address: ESCROW_ADDRESS,
        function: "fillOffer(uint256)",
        note: "First approve the escrow contract for request_amount of request_token, then call fillOffer with the on-chain offer ID.",
        builder_code: BUILDER_CODE,
        calldata: {
          approve: {
            to: reqToken,
            data: encodeEscrowApproveCalldata(reqAmount),
            description: "ERC-20 approve(escrow, request_amount) on request_token",
          },
          fill_offer: fillCalldata
            ? {
                to: ESCROW_ADDRESS,
                data: fillCalldata,
                description: "fillOffer(onchain_offer_id) with Builder Code suffix",
              }
            : {
                to: ESCROW_ADDRESS,
                description:
                  "Pass onchain_offer_id (uint256 from OfferCreated event) to receive ready calldata.",
              },
        },
      },
      offer,
    },
  };
}

export async function marketplaceCancelOffer(
  serviceClient: { from: (t: string) => any },
  creatorAddress: string,
  body: JsonBody
): Promise<ServiceResult> {
  const w = creatorAddress.toLowerCase();
  const { offer_id, onchain_offer_id } = body as {
    offer_id?: string;
    onchain_offer_id?: number | string;
  };
  if (!offer_id) {
    return { status: 400, body: { error: "Missing field: offer_id" } };
  }

  const { data: offer, error } = await serviceClient
    .from("marketplace_offers")
    .select("*")
    .eq("id", offer_id)
    .eq("creator_address", w)
    .eq("status", "active")
    .single();

  if (error || !offer) {
    return { status: 404, body: { error: "Offer not found or not owned by you" } };
  }

  await serviceClient.from("marketplace_offers").update({ status: "cancelled" }).eq("id", offer_id);

  const cancelCalldata =
    onchain_offer_id !== undefined && onchain_offer_id !== null
      ? encodeEscrowCancelOfferCalldata(onchain_offer_id as number | string)
      : null;

  return {
    status: 200,
    body: {
      message: "Offer cancelled. Call cancelOffer on the escrow contract to retrieve your tokens.",
      escrow_contract: {
        address: ESCROW_ADDRESS,
        function: "cancelOffer(uint256)",
        note: "Call cancelOffer with the on-chain offer ID to return escrowed tokens.",
        builder_code: BUILDER_CODE,
        calldata: cancelCalldata
          ? {
              cancel_offer: {
                to: ESCROW_ADDRESS,
                data: cancelCalldata,
                description: "cancelOffer(onchain_offer_id) with Builder Code suffix",
              },
            }
          : {
              cancel_offer: {
                to: ESCROW_ADDRESS,
                description:
                  "Pass onchain_offer_id (uint256 from OfferCreated event) to receive ready calldata.",
              },
            },
      },
    },
  };
}
