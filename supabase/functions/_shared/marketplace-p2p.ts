/**
 * Shared P2P marketplace DB intents (offers list/create/accept/cancel).
 * Used by agent-api (merchant lsk_, creator = ownerAddress) and recipient-api (buyer rwk_, creator = bound wallet).
 */
import { BUILDER_CODE } from "./loyalspark-agent-helpers.ts";

export type JsonBody = Record<string, unknown>;

export type ServiceResult = { status: number; body: JsonBody };

const ADDR = /^0x[a-fA-F0-9]{40}$/;

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
        function: "createOffer(address,uint256,address,uint256)",
        params: [ota, offer_amount, rta, request_amount],
        note: "First approve the escrow contract for offer_amount of offer_token, then call createOffer.",
        builder_code: BUILDER_CODE,
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
  const { offer_id } = body;
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

  return {
    status: 200,
    body: {
      message: "Offer accepted. Execute fillOffer on the escrow contract to complete the atomic swap.",
      escrow_contract: {
        function: "fillOffer(uint256)",
        note: "First approve the escrow contract for request_amount of request_token, then call fillOffer with the on-chain offer ID.",
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
  const { offer_id } = body;
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

  return {
    status: 200,
    body: {
      message: "Offer cancelled. Call cancelOffer on the escrow contract to retrieve your tokens.",
      escrow_contract: {
        function: "cancelOffer(uint256)",
        note: "Call cancelOffer with the on-chain offer ID to return escrowed tokens.",
      },
    },
  };
}
