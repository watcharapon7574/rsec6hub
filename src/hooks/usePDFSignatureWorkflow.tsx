import { useState } from 'react';
import { useAvailableSigners } from '@/hooks/useAvailableSigners';
import { usePDFUpload } from '@/hooks/usePDFUpload';
import { useSignatureBlocks } from '@/hooks/useSignatureBlocks';
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation';

export const usePDFSignatureWorkflow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const availableSigners = useAvailableSigners();
  const { uploadedPdf, pdfUrl, handleFileUpload, resetPDFUpload } = usePDFUpload();
  const {
    selectedSigners,
    signatureBlocks,
    editMode,
    selectedBlockForPosition,
    setEditMode,
    setSelectedBlockForPosition,
    handleSignerSelect,
    handleCommentChange,
    handlePositionClick,
    handleBlockPositionUpdate,
    handleBlockVisibilityToggle,
    resetSignatureBlocks
  } = useSignatureBlocks();
  const { canProceedToNextStep } = useWorkflowValidation();

  const resetWorkflow = () => {
    setCurrentStep(1);
    setLoading(false);
    resetPDFUpload();
    resetSignatureBlocks();
  };

  const canProceed = () => canProceedToNextStep(currentStep, uploadedPdf, selectedSigners, signatureBlocks);

  return {
    // State
    currentStep,
    uploadedPdf,
    pdfUrl,
    selectedSigners,
    signatureBlocks,
    editMode,
    selectedBlockForPosition,
    loading,
    availableSigners,
    
    // Actions
    setCurrentStep,
    setEditMode,
    setSelectedBlockForPosition,
    setLoading,
    handleFileUpload,
    handleSignerSelect,
    handleCommentChange,
    handlePositionClick,
    handleBlockPositionUpdate,
    handleBlockVisibilityToggle,
    canProceedToNextStep: canProceed,
    resetWorkflow
  };
};