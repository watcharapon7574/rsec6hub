import { SelectedSigners, SignatureBlock } from '@/types/pdfSignature';

export const useWorkflowValidation = () => {
  const canProceedToNextStep = (
    currentStep: number,
    uploadedPdf: File | null,
    selectedSigners: SelectedSigners,
    signatureBlocks: SignatureBlock[]
  ) => {
    switch (currentStep) {
      case 1:
        return uploadedPdf !== null;
      case 2:
        return selectedSigners.director !== undefined; // Director is required
      case 3:
        return signatureBlocks.length > 0;
      default:
        return true;
    }
  };

  return { canProceedToNextStep };
};