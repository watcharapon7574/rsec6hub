import { SignatureBlock } from '@/types/pdfSignature';
import { railwayPDFQueue } from '@/utils/requestQueue';

const API_BASE_URL = 'https://pdf-memo-docx-production-25de.up.railway.app';

export const submitPDFSignature = async (
  uploadedPdf: File,
  signatureBlocks: SignatureBlock[]
): Promise<Blob> => {
  
  const formData = new FormData();
  formData.append('pdf', uploadedPdf);

  // Create signatures array
  const signatures: any[] = [];
  const signatureFiles: { [key: string]: string } = {};

  signatureBlocks.filter(block => block.visible).forEach((block, index) => {

    // Add text block for signer info
    const textContent = [
      block.signer.position,
      block.signer.name,
      block.signer.comment || ''
    ].filter(Boolean).join('\n');

    signatures.push({
      type: 'text',
      text: textContent,
      x: block.position.x,
      y: block.position.y,
      page: block.position.page,
      color: [2, 53, 139]
    });

    // Add signature image if available
    if (block.signer.signature_url) {
      const fileKey = `sig_${block.role}`;
      signatures.push({
        type: 'image',
        file_key: fileKey,
        x: block.position.x,
        y: block.position.y - 30, // Position image above text
        page: block.position.page
      });
      signatureFiles[fileKey] = block.signer.signature_url;
    }
  });

  // Download and add signature image files to FormData
  for (const [fileKey, imageUrl] of Object.entries(signatureFiles)) {
    try {
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        formData.append(fileKey, imageBlob, `${fileKey}.png`);
      }
    } catch (error) {
      console.error(`Failed to fetch signature image for ${fileKey}:`, error);
    }
  }

  formData.append('signatures', JSON.stringify(signatures));

  // Call Railway add_signature API with queue + retry logic
  const signedBlob = await railwayPDFQueue.enqueueWithRetry(
    async () => {
      const response = await fetch(`${API_BASE_URL}/add_signature`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type for FormData, let browser set it with boundary
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      return await response.blob();
    },
    'PDF Signature',
    3, // max retries
    1000 // initial delay
  );

  return signedBlob;
};

export const downloadSignedPDF = (blob: Blob, originalFileName: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `signed_${originalFileName}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};