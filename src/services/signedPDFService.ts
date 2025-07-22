const API_BASE_URL = 'https://pdf-memo-docx-production.up.railway.app';

export interface SignedPDFRequest {
  name: string;
  position: string;
  signature: File;
  // เพิ่มฟิลด์อื่นๆ ตามที่ backend ต้องการ
  [key: string]: any;
}

export const generateSignedPDF = async (data: SignedPDFRequest): Promise<Blob> => {
  
  const formData = new FormData();
  
  // เพิ่มข้อมูลพื้นฐาน
  formData.append('name', data.name);
  formData.append('position', data.position);
  formData.append('signature', data.signature, data.signature.name);
  
  // เพิ่มฟิลด์อื่นๆ ที่ส่งมา
  Object.keys(data).forEach(key => {
    if (key !== 'name' && key !== 'position' && key !== 'signature') {
      const value = data[key];
      if (value instanceof File) {
        formData.append(key, value, value.name);
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  const response = await fetch(`${API_BASE_URL}/generate_signed_pdf`, {
    method: 'POST',
    body: formData,
    // ไม่ต้องตั้ง Content-Type เพราะ browser จะตั้งค่า boundary ให้เอง
  });


  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error Response:', errorText);
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  const pdfBlob = await response.blob();
  
  return pdfBlob;
};

export const downloadGeneratedPDF = (blob: Blob, fileName: string = 'signed_document.pdf') => {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};

export const previewPDF = (blob: Blob): string => {
  return URL.createObjectURL(blob);
};