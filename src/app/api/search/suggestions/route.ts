import { NextRequest, NextResponse } from "next/server";
import { suggestProducts } from "@/lib/search-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const suggestions = await suggestProducts(q);
  return NextResponse.json({ suggestions });
}
