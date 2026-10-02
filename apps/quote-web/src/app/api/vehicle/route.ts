import { NextResponse, type NextRequest } from "next/server";
import { normaliseReg, REG_PATTERN, VehicleLookupError } from "@qf/adapters";
import { readQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";

/**
 * GET /api/vehicle?reg=AB12CDE: the lookup endpoint from the component spec. Only available
 * within an active quote session, so it cannot be used as an open vehicle-data service.
 */
export async function GET(request: NextRequest) {
  if ((await readQuoteSession()).state !== "active") return NextResponse.json({ error: "No active quote" }, { status: 401 });
  const reg = normaliseReg(request.nextUrl.searchParams.get("reg") ?? "");
  if (!REG_PATTERN.test(reg)) return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
  try {
    const vehicle = await services.vehicles.lookup(reg);
    return vehicle ? NextResponse.json(vehicle) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof VehicleLookupError) return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    throw error;
  }
}
