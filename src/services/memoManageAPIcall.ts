// types.ts
interface MergeResponse {
  error?: string;
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