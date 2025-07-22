import { MemoApprovalData, ApprovalStep } from '@/types/memoApproval';

export const callPDFSignatureAPI = async (
  memoData: MemoApprovalData,
  approvalSteps: ApprovalStep[]
) => {
  // Collect all approval data
  const signatureData = approvalSteps.map(step => ({
    name: step.name,
    position: step.position,
    signature_url: step.signature_url,
    comment: step.comment,
    timestamp: step.approved_at,
    status: step.status
  }));

  const apiData = {
    document_title: memoData.document_title,
    document_content: memoData.content,
    signatures: signatureData,
    created_at: memoData.created_at
  };


  const response = await fetch('/pdf_with_signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiData),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const pdfBlob = await response.blob();
  
  // Download PDF
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${memoData.document_title}_signed.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};