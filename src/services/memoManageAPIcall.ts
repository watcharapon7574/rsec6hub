// types.ts
interface MergeResponse {
  error?: string;
  mergedPdfUrl?: string;
}

interface MemoMergeRequest {
  memoId: string;
  mainPdfPath: string;
  attachedFiles: string[];
}

// PDF Merge API call for memo documents
export async function mergeMemoWithAttachments(memoData: MemoMergeRequest): Promise<{ success: boolean; mergedPdfUrl?: string; error?: string }> {
  try {
    console.log('📄 Starting PDF merge process...', memoData);
    
    // Fetch the main PDF file
    console.log('📥 Fetching main PDF:', memoData.mainPdfPath);
    const mainPdfResponse = await fetch(memoData.mainPdfPath);
    if (!mainPdfResponse.ok) {
      throw new Error(`Failed to fetch main PDF: ${mainPdfResponse.status} ${mainPdfResponse.statusText}`);
    }
    let currentPdfBlob = await mainPdfResponse.blob();
    console.log('✅ Main PDF fetched, size:', currentPdfBlob.size);
    
    // Fetch all attached files
    const attachedBlobs: Blob[] = [];
    for (let i = 0; i < memoData.attachedFiles.length; i++) {
      const attachedFileUrl = memoData.attachedFiles[i];
      console.log(`📥 Fetching attached file ${i + 1}:`, attachedFileUrl);
      
      const fileResponse = await fetch(attachedFileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch attached file ${i + 1}: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      const fileBlob = await fileResponse.blob();
      console.log(`✅ Attached file ${i + 1} fetched, size:`, fileBlob.size);
      attachedBlobs.push(fileBlob);
    }

    // Merge PDFs sequentially (main + attachment1, then result + attachment2, etc.)
    for (let i = 0; i < attachedBlobs.length; i++) {
      console.log(`🔄 Merging with attachment ${i + 1}...`);
      
      const formData = new FormData();
      formData.append('pdf1', currentPdfBlob, `current_${i}.pdf`);
      formData.append('pdf2', attachedBlobs[i], `attachment_${i + 1}.pdf`);

      console.log(`📤 Sending merge request ${i + 1}/${attachedBlobs.length} to PDFmerge API...`);
      
      const response: Response = await fetch('https://pdf-memo-docx-production.up.railway.app/PDFmerge', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        body: formData
      });

      if (response.ok) {
        currentPdfBlob = await response.blob();
        console.log(`✅ Merge ${i + 1} successful, new size:`, currentPdfBlob.size);
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.text();
          console.error('❌ PDF merge failed:', errorData);
          errorMessage = errorData || errorMessage;
        } catch {
          // If response is not text, use the status message
        }
        
        return {
          success: false,
          error: `Failed to merge attachment ${i + 1}: ${errorMessage}`
        };
      }
    }

    // All merges completed successfully, currentPdfBlob now contains the final merged PDF
    console.log('✅ All PDF merges completed successfully, final size:', currentPdfBlob.size);
    
    // Upload the merged PDF to Supabase Storage
    const fileName = `merged_memo_${memoData.memoId}_${Date.now()}.pdf`;
    const filePath = `memos/merged/${fileName}`;
    
    // Import supabase here to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, currentPdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Failed to upload merged PDF:', uploadError);
      return {
        success: false,
        error: `Failed to upload merged PDF: ${uploadError.message}`
      };
    }

    if (!uploadData?.path) {
      return {
        success: false,
        error: 'Upload successful but no path returned'
      };
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData.path);

    console.log('📁 Merged PDF uploaded successfully:', publicUrl);
    
    return {
      success: true,
      mergedPdfUrl: publicUrl
    };
  } catch (error: unknown) {
    console.error('Error merging PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred'
    };
  }
}

// pdfMerger.ts
async function mergePDFs(): Promise<void> {
  const pdf1Input = document.getElementById('pdf1') as HTMLInputElement;
  const pdf2Input = document.getElementById('pdf2') as HTMLInputElement;
  
  const pdf1File: File | null = pdf1Input.files?.[0] || null;
  const pdf2File: File | null = pdf2Input.files?.[0] || null;
  
  if (!pdf1File || !pdf2File) {
    alert('กรุณาเลือกไฟล์ PDF ทั้ง 2 ไฟล์');
    return;
  }
  
  const formData = new FormData();
  formData.append('pdf1', pdf1File);
  formData.append('pdf2', pdf2File);
  
  try {
    const response: Response = await fetch('/PDFmerge', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const blob: Blob = await response.blob();
      downloadPDF(blob, 'merged.pdf');
    } else {
      const error: MergeResponse = await response.json();
      alert(`Error: ${error.error}`);
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    alert(`เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function downloadPDF(blob: Blob, filename: string): void {
  const url: string = window.URL.createObjectURL(blob);
  const a: HTMLAnchorElement = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}