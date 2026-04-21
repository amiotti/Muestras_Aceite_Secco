import { getSamplePdf } from "@/lib/s360-service";

export async function GET(_request, { params }) {
  try {
    const sampleNumber = params?.sampleNumber;
    if (!sampleNumber) {
      return new Response("Falta numero de muestra.", { status: 400 });
    }

    const pdfBuffer = await getSamplePdf(sampleNumber);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"muestra-${sampleNumber}.pdf\"`,
      },
    });
  } catch (error) {
    return new Response(error?.message || "Error exportando PDF.", { status: 500 });
  }
}

