import { NextResponse } from "next/server";
import { loadEquipmentOptions } from "@/lib/s360-service";

export async function GET() {
  try {
    const payload = await loadEquipmentOptions();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Error cargando equipos." },
      { status: 500 }
    );
  }
}

