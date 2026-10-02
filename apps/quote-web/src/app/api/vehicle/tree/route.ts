import { NextResponse } from "next/server";
import { readQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";

/** GET /api/vehicle/tree: make → model → transmission → year → variants, for manual lookup. */
export async function GET() {
  if ((await readQuoteSession()).state !== "active") return NextResponse.json({ error: "No active quote" }, { status: 401 });
  return NextResponse.json(await services.vehicles.tree(), { headers: { "Cache-Control": "private, max-age=3600" } });
}
