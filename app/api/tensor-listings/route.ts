import { NextResponse } from "next/server";

const BASE = "https://api.mainnet.tensordev.io/api/v1";

export async function POST(req: Request) {
  const { query, collId } = await req.json().catch(() => ({}));
  const key = "89fecaad-af57-4d3e-9d03-e822507aa93a"
  if (!key) return NextResponse.json({ ok: false, error: "set TENSOR_API_KEY" });

  let url: string;
  let label: string;
  if (collId) {
    const q = new URLSearchParams({ collId: String(collId), sortBy: "ListingPriceAsc", limit: "5" });
    url = `${BASE}/mint/active_listings?${q}`;
    label = "Tensor listings";
  } else if (query) {
    const q = new URLSearchParams({ query: String(query), sortBy: "statsV2.numListed:desc", limit: "5" });
    url = `${BASE}/collections/search_collections?${q}`;
    label = "Tensor collection search";
  } else {
    return NextResponse.json({ ok: false, error: "send a query or a collId" });
  }

  const res = await fetch(url, { headers: { "x-tensor-api-key": key } });
  const json = await res.json().catch(() => null);
  return NextResponse.json({
    ok: res.ok,
    label,
    status: res.status,
    json,
    error: res.ok ? undefined : "tensor request failed",
  });
}