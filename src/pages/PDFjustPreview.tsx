import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { ArrowLeft } from 'lucide-react';
import { useAllMemos } from '@/hooks/useAllMemos';

const PDFjustPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getMemoById } = useAllMemos();
  
  // รับ url และชื่อไฟล์จาก state หรือ query
  const { fileUrl, fileName, memoId } = location.state || {};
  
  const [memo, setMemo] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  useEffect(() => {
    const loadMemoData = async () => {
      if (memoId && getMemoById) {
        try {
          const memoData = await getMemoById(memoId);
          if (memoData) {
            setMemo(memoData);
            
            // Parse attached files
            let files = [];
            if (memoData.attached_files) {
              try {
                if (typeof memoData.attached_files === 'string') {
                  const parsed = JSON.parse(memoData.attached_files);
                  files = Array.isArray(parsed) ? parsed : [];
                } else if (Array.isArray(memoData.attached_files)) {
                  files = memoData.attached_files;
                }
              } catch {
                files = [];
              }
            }
            setAttachedFiles(files);
          }
        } catch (error) {
          console.error('Error loading memo:', error);
        }
      }
    };

    loadMemoData();
  }, [memoId, getMemoById]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-6 pb-24">
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <div className="flex items-center">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับ
          </Button>
        </div>
        
        <PDFViewer fileUrl={fileUrl} fileName={fileName || 'ไฟล์ PDF'} editMode={false} showSignatureMode={false} showZoomControls={true} />
        
        {/* Show attached files accordion if available */}
        {attachedFiles.length > 0 && (
          <Accordion 
            attachments={attachedFiles}
            attachmentTitle={memo?.attachment_title}
          />
        )}
        
        <div className="h-10" />
      </div>
    </div>
  );
};

export default PDFjustPreview;
