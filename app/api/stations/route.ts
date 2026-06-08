import { NextResponse } from "next/server";
import { STATIONS } from "@/lib/stations";

export function GET() {
  return NextResponse.json({ stations: STATIONS });
}
