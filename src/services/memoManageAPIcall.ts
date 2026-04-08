import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';

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
    // Fetch the main PDF file
    const mainPdfResponse = await fetch(memoData.mainPdfPath);
    if (!mainPdfResponse.ok) {
      throw new Error(`Failed to fetch main PDF: ${mainPdfResponse.status} ${mainPdfResponse.statusText}`);
    }
    let currentPdfBlob = await mainPdfResponse.blob();
    
    // Fetch all attached files
    const attachedBlobs: Blob[] = [];
    for (let i = 0; i < memoData.attachedFiles.length; i++) {
      const attachedFileUrl = memoData.attachedFiles[i];
      const fileResponse = await fetch(attachedFileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch attached file ${i + 1}: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      const fileBlob = await fileResponse.blob();
      attachedBlobs.push(fileBlob);
    }

    // Merge PDFs sequentially (main + attachment1, then result + attachment2, etc.)
    for (let i = 0; i < attachedBlobs.length; i++) {
      const formData = new FormData();
      formData.append('pdf1', currentPdfBlob, `current_${i}.pdf`);
      formData.append('pdf2', attachedBlobs[i], `attachment_${i + 1}.pdf`);

      // Call Railway PDFmerge API with queue + retry logic
      currentPdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response: Response = await railwayFetch('/PDFmerge', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorData = await response.text();
              errorMessage = errorData || errorMessage;
            } catch {
              // If response is not text, use the status message
            }
            throw new Error(errorMessage);
          }

          const blob = await response.blob();
          return blob;
        },
        'PDF Merge',
        3, // max retries
        1000 // initial delay
      );
    }

    // All merges completed successfully, currentPdfBlob now contains the final merged PDF
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