import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText, Paperclip, Eye, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PDFViewer from './PDFViewer';

interface AccordionProps {
  attachments: string[]; // Array of file URLs
  title?: string;
  attachmentTitle?: string; // For displaying attachment title instead of count
  className?: string;
}

const Accordion: React.FC<AccordionProps> = ({ 
  attachments = [], 
  title = "สิ่งที่ส่งมาด้วย",
  attachmentTitle,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSelectedFileIndex(null); // Reset selected file when closing
    }
  };

  const getFileName = (url: string) => {
    try {
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      return decodeURIComponent(fileName);
    } catch {
      return 'ไฟล์แนบ';
    }
  };

  const getFileExtension = (url: string) => {
    const fileName = getFileName(url);
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const isPDF = (url: string) => {
    return getFileExtension(url) === 'pdf';
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div
          onClick={toggleAccordion}
          className="flex items-center justify-between w-full cursor-pointer hover:bg-muted rounded px-2 py-1"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-blue-600" />
            {attachmentTitle ? `สิ่งที่ส่งมาด้วย ${attachmentTitle}` : title}
          </CardTitle>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* PDF Preview - แสดงเลยเพราะมีไฟล์เดียว */}
            {attachments.length > 0 && isPDF(attachments[0]) && (
              <div className="border rounded-lg overflow-hidden">
                <PDFViewer
                  fileUrl={attachments[0]}
                  fileName={getFileName(attachments[0])}
                  showSignatureMode={false}
                  showZoomControls={true}
                />
              </div>
            )}
            
            
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default Accordion;
