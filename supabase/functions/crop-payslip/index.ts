import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument } from "pdf-lib";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, page, half, center_offset, orientation } = await req.json();

    if (!file_url || !page || !half) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_url, page, half" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the PDF
    const pdfResponse = await fetch(file_url);
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download PDF: ${pdfResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();

    if (page < 1 || page > totalPages) {
      return new Response(
        JSON.stringify({ error: `Page ${page} out of range (1-${totalPages})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const srcPage = srcDoc.getPage(page - 1);
    const { width, height } = srcPage.getSize();
    const offset = typeof center_offset === "number" ? center_offset : 0;

    let clipLeft: number, clipRight: number, clipBottom: number, clipTop: number;

    if (orientation === "landscape") {
      // Landscape: split top/bottom at midY
      const midY = (height / 2) + (height * offset / 100);
      clipLeft = 0;
      clipRight = width;
      if (half === "top") {
        clipBottom = midY;
        clipTop = height;
      } else {
        clipBottom = 0;
        clipTop = midY;
      }
    } else {
      // Portrait (legacy): split left/right at midX
      const midX = (width / 2) + (width * offset / 100);
      clipBottom = 0;
      clipTop = height;
      if (half === "left") {
        clipLeft = 0;
        clipRight = midX;
      } else {
        clipLeft = midX;
        clipRight = width;
      }
    }

    const cropWidth = clipRight - clipLeft;
    const cropHeight = clipTop - clipBottom;

    // Embed the source page clipped to the desired region
    const outDoc = await PDFDocument.create();
    const embeddedPage = await outDoc.embedPage(srcPage, {
      left: clipLeft,
      bottom: clipBottom,
      right: clipRight,
      top: clipTop,
    });

    // For landscape crops, output as landscape A4; for portrait, output as portrait A4
    const outWidth = orientation === "landscape" ? A4_HEIGHT : A4_WIDTH;
    const outHeight = orientation === "landscape" ? A4_WIDTH : A4_HEIGHT;

    const a4Page = outDoc.addPage([outWidth, outHeight]);

    // Scale to fit without upscaling
    const scale = Math.min(outWidth / cropWidth, outHeight / cropHeight, 1);
    const drawWidth = cropWidth * scale;
    const drawHeight = cropHeight * scale;
    const x = (outWidth - drawWidth) / 2;
    const y = (outHeight - drawHeight) / 2;

    a4Page.drawPage(embeddedPage, { x, y, width: drawWidth, height: drawHeight });

    const croppedBytes = await outDoc.save();

    return new Response(croppedBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="payslip_p${page}_${half}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Crop error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
