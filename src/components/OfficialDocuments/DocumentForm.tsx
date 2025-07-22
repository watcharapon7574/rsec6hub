import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DocumentFormProps {
  documentTitle: string;
  documentContent: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
}

const DocumentForm: React.FC<DocumentFormProps> = ({
  documentTitle,
  documentContent,
  onTitleChange,
  onContentChange
}) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="document_title">หัวข้อเอกสาร</Label>
        <Input
          id="document_title"
          value={documentTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="document_content">เนื้อหาเอกสาร</Label>
        <Textarea
          id="document_content"
          value={documentContent}
          onChange={(e) => onContentChange(e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>
    </div>
  );
};

export default DocumentForm;