import React, { useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';

interface ReadDocumentButtonProps {
  documentSubject: string;
  documentPdfUrl: string | null;
}

const ReadDocumentButton: React.FC<ReadDocumentButtonProps> = ({
  documentSubject,
  documentPdfUrl,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full h-auto py-2 flex-col items-center gap-0.5 border-pink-300 dark:border-pink-700 bg-pink-50/60 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900 text-pink-700 dark:text-pink-200"
      >
        <span className="flex items-center gap-2 font-medium">
          <BookOpen className="h-4 w-4" />
          อ่านเอกสารอีกครั้ง
        </span>
        {documentSubject && (
          <span className="text-xs font-normal text-pink-600/80 dark:text-pink-300/80 line-clamp-1 max-w-full px-2">
            {documentSubject}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
          <div className="px-6 pt-6 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-pink-900 dark:text-pink-100">
              <BookOpen className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              อ่านเอกสาร
            </DialogTitle>
            <DialogDescription className="mt-1 line-clamp-2">
              {documentSubject || 'เอกสาร'}
            </DialogDescription>
          </div>
          <div className="flex-1 min-h-0 p-4 overflow-hidden">
            {documentPdfUrl ? (
              <div className="h-full border-2 border-pink-200 dark:border-pink-800 rounded-lg overflow-hidden shadow-inner">
                <PDFViewer
                  fileUrl={documentPdfUrl}
                  fileName={documentSubject || 'เอกสาร'}
                  editMode={false}
                  showSignatureMode={false}
                  showZoomControls={true}
                  showFullscreenButton={true}
                />
              </div>
            ) : (
              <div className="h-full border-2 border-pink-200 dark:border-pink-800 rounded-lg flex items-center justify-center bg-pink-50 dark:bg-pink-950">
                <div className="text-center text-pink-600 dark:text-pink-400">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">ไม่มีไฟล์ PDF</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReadDocumentButton;
