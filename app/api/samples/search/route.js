import { NextResponse } from "next/server";
import { searchSamples } from "@/lib/s360-service";

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = await searchSamples(body || {});
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Error buscando muestras." },
      { status: 500 }
    );
  }
}

