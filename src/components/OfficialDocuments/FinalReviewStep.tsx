import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { SelectedSigner, SignatureBlock } from '@/types/pdfSignature';

interface FinalReviewStepProps {
  uploadedPdf: File | null;
  selectedSigners: {
    assistant?: SelectedSigner;
    deputy?: SelectedSigner;
    director?: SelectedSigner;
  };
  signatureBlocks: SignatureBlock[];
}

const FinalReviewStep: React.FC<FinalReviewStepProps> = ({
  uploadedPdf,
  selectedSigners,
  signatureBlocks
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5" />
          ตรวจสอบข้อมูล
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-gray-800">ไฟล์:</p>
          <p className="text-gray-600">{uploadedPdf?.name}</p>
        </div>
        <div>
          <p className="font-medium text-gray-800">ผู้ลงนาม:</p>
          <ul className="text-gray-600 space-y-1">
            {Object.entries(selectedSigners).map(([role, signer]) => (
              <li key={role}>• {signer.name} ({role})</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-gray-800">บล็อกลายเซ็น:</p>
          <p className="text-gray-600">{signatureBlocks.filter(b => b.visible).length} บล็อก</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinalReviewStep;