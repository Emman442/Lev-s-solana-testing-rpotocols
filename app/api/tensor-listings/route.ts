import { NextResponse } from "next/server";

const BASE = "https://api.mainnet.tensordev.io/api/v1";

export async function POST(req: Request) {
  const { query, collId } = await req.json().catch(() => ({}));
  const key = "89fecaad-af57-4d3e-9d03-e822507aa93a";

  let url: string;
  let label: string;
  if (collId) {
    const q = new URLSearchParams({ collId: String(collId), sortBy: "ListingPriceAsc", limit: "5" });
    url = `${BASE}/mint/active_listings?${q}`;
    label = "Tensor listings";
  } else {
    const q = new URLSearchParams({ sortBy: "statsV2.numListed:desc", limit: "10" });
    if (query) q.set("query", String(query));
    url = `${BASE}/collections/search_collections?${q}`;
    label = query ? "Tensor collection search" : "Tensor top collections by listings";
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