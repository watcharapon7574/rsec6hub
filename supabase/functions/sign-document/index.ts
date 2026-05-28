import { createClient } from "jsr:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RAILWAY_API = "https://pdf-memo-docx-production-25de.up.railway.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      pdfUrl,
      signatureUrl,
      signatures,
      oldFilePath,
      newFilePath,
      documentId,
      tableName,
      newStatus,
      nextSignerOrder,
    } = body;

    console.log("📝 sign-document called:", { documentId, tableName, newStatus, nextSignerOrder });

    // Validate required fields
    if (!pdfUrl || !signatureUrl || !signatures || !documentId || !tableName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Download PDF + signature in parallel (server-to-server = fast)
    console.log("📥 Downloading PDF and signature...");
    const startDownload = Date.now();
    const [pdfRes, sigRes] = await Promise.all([
      fetch(pdfUrl),
      fetch(signatureUrl),
    ]);

    if (!pdfRes.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfRes.status} ${pdfRes.statusText}`);
    }
    if (!sigRes.ok) {
      throw new Error(`Failed to fetch signature: ${sigRes.status} ${sigRes.statusText}`);
    }

    // Scope blobs to a block so refs can be released for GC after Railway sends them
    let signedPdfBlob: Blob;
    let railwayContentType: string;
    let railwayMs: number;
    {
      const [pdfBlob, sigBlob] = await Promise.all([
        pdfRes.blob(),
        sigRes.blob(),
      ]);
      console.log(`✅ Downloaded in ${Date.now() - startDownload}ms - PDF: ${pdfBlob.size}B, Sig: ${sigBlob.size}B`);

      // 2. Call Railway API /add_signature_v2
      console.log("🚂 Calling Railway API...");
      const startRailway = Date.now();
      const formData = new FormData();
      formData.append("pdf", pdfBlob, "document.pdf");
      formData.append("sig1", sigBlob, "signature.png");
      formData.append("signatures", JSON.stringify(signatures));

      const railwayRes = await fetch(`${RAILWAY_API}/add_signature_v2`, {
        method: "POST",
        body: formData,
      });

      if (!railwayRes.ok) {
        const errorText = await railwayRes.text();
        throw new Error(`Railway API error: ${railwayRes.status} - ${errorText}`);
      }

      railwayContentType = railwayRes.headers.get('content-type') || '';
      signedPdfBlob = await railwayRes.blob();
      railwayMs = Date.now() - startRailway;
    }
    // pdfBlob/sigBlob/formData out of scope here — eligible for GC while we upload
    console.log(`🚂 Railway response content-type: ${railwayContentType}`);
    console.log(`✅ Railway done in ${railwayMs}ms - Signed PDF: ${signedPdfBlob.size}B, type: ${signedPdfBlob.type}`);

    // Sanity: response too small → probably an error JSON, not a PDF
    if (signedPdfBlob.size < 1000) {
      const textContent = await signedPdfBlob.text();
      console.error(`❌ Railway returned small response (${signedPdfBlob.size}B): ${textContent}`);
      try {
        const errorJson = JSON.parse(textContent);
        throw new Error(`Railway API returned error: ${errorJson.error || errorJson.message || textContent}`);
      } catch (parseErr) {
        if (parseErr instanceof SyntaxError) {
          throw new Error(`Railway API returned invalid response (${signedPdfBlob.size}B): ${textContent.substring(0, 200)}`);
        }
        throw parseErr;
      }
    }

    // If content-type isn't PDF, verify magic bytes (read only first 5 bytes, not the whole blob)
    if (railwayContentType && !railwayContentType.includes('pdf') && !railwayContentType.includes('octet-stream')) {
      const headerBytes = new Uint8Array(await signedPdfBlob.slice(0, 5).arrayBuffer());
      const header = String.fromCharCode(...headerBytes);
      if (header !== '%PDF-') {
        const previewBytes = new Uint8Array(await signedPdfBlob.slice(0, 200).arrayBuffer());
        const textPreview = new TextDecoder().decode(previewBytes);
        console.error(`❌ Railway response is not a PDF. Header: ${header}, Preview: ${textPreview}`);
        throw new Error(`Railway API did not return a valid PDF (content-type: ${railwayContentType})`);
      }
      console.log(`✅ Verified PDF by header (content-type was ${railwayContentType})`);
    }

    // 3. Upload signed PDF to Supabase Storage — pass Blob directly (no extra ArrayBuffer copy)
    console.log("📤 Uploading signed PDF...");
    const startUpload = Date.now();
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(newFilePath, signedPdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }
    console.log(`✅ Uploaded in ${Date.now() - startUpload}ms`);

    // 4. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(newFilePath);

    // 5. Update database
    console.log("💾 Updating database...");
    const updateData: Record<string, unknown> = {
      status: newStatus,
      current_signer_order: nextSignerOrder,
      pdf_draft_path: publicUrl,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("id", documentId);

    if (updateError) {
      // Rollback: delete uploaded file
      await supabase.storage.from("documents").remove([newFilePath]);
      throw new Error(`Database update error: ${updateError.message}`);
    }

    // 6. Delete old file (non-blocking, don't fail if this errors)
    if (oldFilePath) {
      try {
        await supabase.storage.from("documents").remove([oldFilePath]);
        console.log("🗑️ Old file deleted");
      } catch (e) {
        console.warn("⚠️ Failed to delete old file:", e);
      }
    }

    console.log("✅ sign-document completed successfully");
    return new Response(
      JSON.stringify({ success: true, publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ sign-document error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
