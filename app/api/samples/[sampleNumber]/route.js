import { NextResponse } from "next/server";
import { getSampleDetail } from "@/lib/s360-service";

export async function GET(_request, { params }) {
  try {
    const sampleNumber = params?.sampleNumber;
    if (!sampleNumber) {
      return NextResponse.json({ error: "Falta numero de muestra." }, { status: 400 });
    }

    const payload = await getSampleDetail(sampleNumber);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Error viendo muestra." },
      { status: 500 }
    );
  }
}

