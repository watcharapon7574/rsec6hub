import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, MessageCircle, PenTool, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PDFAnnotationEditor from './PDFAnnotationEditor';
import { uploadAnnotatedPdf } from '@/utils/pdfAnnotationUtils';

interface AnnotatableFile {
  label: string;
  url: string;
}

interface RejectionCardProps {
  onReject: (reason: string, annotatedPdfUrl?: string, annotatedAttachments?: string[]) => void;
  isLoading?: boolean;
  pdfUrl?: string;
  attachedFiles?: string[];
  documentId?: string;
  userId?: string;
}

export const RejectionCard: React.FC<RejectionCardProps> = ({
  onReject,
  isLoading = false,
  pdfUrl,
  attachedFiles = [],
  documentId,
  userId,
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [showFileList, setShowFileList] = useState(false);

  // Annotation editor state
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingFileUrl, setEditingFileUrl] = useState<string | null>(null);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);

  // Annotated URLs: main PDF + each attachment
  const [annotatedMainUrl, setAnnotatedMainUrl] = useState<string | null>(null);
  const [annotatedAttachmentUrls, setAnnotatedAttachmentUrls] = useState<Map<number, string>>(new Map());

  const { toast } = useToast();

  // Build list of all annotatable files
  const annotatableFiles: AnnotatableFile[] = [];
  if (pdfUrl) {
    annotatableFiles.push({ label: 'เอกสารหลัก', url: pdfUrl });
  }
  const pdfAttachments = attachedFiles.filter(f => f && f.toLowerCase().includes('.pdf'));
  pdfAttachments.forEach((url, i) => {
    const fileName = decodeURIComponent(url.split('/').pop() || `ไฟล์แนบ ${i + 1}`).replace(/\?.*$/, '');
    annotatableFiles.push({ label: `ไฟล์แนบ: ${fileName}`, url });
  });

  const hasAnnotatableFiles = annotatableFiles.length > 0 && documentId && userId;

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "กรุณาระบุเหตุผล",
        description: "กรุณาระบุเหตุผลการตีกลับเอกสาร",
        variant: "destructive",
      });
      return;
    }

    const attachmentAnnotations = Array.from(annotatedAttachmentUrls.values());
    onReject(
      rejectionReason.trim(),
      annotatedMainUrl || undefined,
      attachmentAnnotations.length > 0 ? attachmentAnnotations : undefined
    );
    setRejectionReason('');
    setShowReasonInput(false);
    setShowFileList(false);
    setAnnotatedMainUrl(null);
    setAnnotatedAttachmentUrls(new Map());
  };

  const handleCancel = () => {
    setRejectionReason('');
    setShowReasonInput(false);
    setShowFileList(false);
    setAnnotatedMainUrl(null);
    setAnnotatedAttachmentUrls(new Map());
  };

  const openEditorForFile = (url: string) => {
    setEditingFileUrl(url);
    setShowAnnotationEditor(true);
  };

  const handleAnnotationSave = async (blob: Blob) => {
    if (!documentId || !userId || !editingFileUrl) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่พบข้อมูลเอกสาร", variant: "destructive" });
      return;
    }

    setIsSavingAnnotation(true);
    try {
      const url = await uploadAnnotatedPdf(blob, documentId, userId);

      // Determine which file was being edited
      if (editingFileUrl === pdfUrl) {
        setAnnotatedMainUrl(url);
      } else {
        const attachIdx = pdfAttachments.indexOf(editingFileUrl);
        if (attachIdx >= 0) {
          setAnnotatedAttachmentUrls(prev => {
            const next = new Map(prev);
            next.set(attachIdx, url);
            return next;
          });
        }
      }

      setShowAnnotationEditor(false);
      setEditingFileUrl(null);

      toast({
        title: "บันทึก annotation สำเร็จ",
        description: "เลือกไฟล์อื่นเพื่อ annotate ต่อ หรือกดถัดไปเพื่อระบุเหตุผล",
      });
    } catch (error) {
      console.error('Error uploading annotated PDF:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึก annotation ได้", variant: "destructive" });
    } finally {
      setIsSavingAnnotation(false);
    }
  };

  const isFileAnnotated = (url: string): boolean => {
    if (url === pdfUrl) return !!annotatedMainUrl;
    const idx = pdfAttachments.indexOf(url);
    return idx >= 0 && annotatedAttachmentUrls.has(idx);
  };

  const totalAnnotated = (annotatedMainUrl ? 1 : 0) + annotatedAttachmentUrls.size;

  return (
    <>
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            ตีกลับเอกสาร
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Initial button */}
          {!showFileList && !showReasonInput && (
            <div className="text-center">
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                หากพบปัญหาหรือข้อผิดพลาดในเอกสาร สามารถตีกลับเพื่อให้ผู้เขียนแก้ไขได้
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  if (hasAnnotatableFiles) {
                    setShowFileList(true);
                  } else {
                    setShowReasonInput(true);
                  }
                }}
                className="w-full"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                ตีกลับเอกสาร
              </Button>
            </div>
          )}

          {/* Step 2: File selection for annotation */}
          {showFileList && !showReasonInput && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">
                เลือกไฟล์ที่ต้องการขีดเขียน annotation:
              </p>
              <div className="space-y-2">
                {annotatableFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                      isFileAnnotated(file.url)
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {isFileAnnotated(file.url) ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm flex-1 truncate">{file.label}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditorForFile(file.url)}
                    >
                      <PenTool className="h-3 w-3 mr-1" />
                      {isFileAnnotated(file.url) ? 'แก้ไข' : 'ขีดเขียน'}
                    </Button>
                  </div>
                ))}
              </div>

              {totalAnnotated > 0 && (
                <p className="text-xs text-green-600">
                  annotate แล้ว {totalAnnotated} ไฟล์
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  ยกเลิก
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowFileList(false);
                    setShowReasonInput(true);
                  }}
                  className="flex-1"
                >
                  ถัดไป: ระบุเหตุผล
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Reason input + confirm */}
          {showReasonInput && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">เหตุผลการตีกลับ</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="กรุณาระบุเหตุผลการตีกลับเอกสาร เช่น ข้อมูลไม่ครบถ้วน, รูปแบบไม่ถูกต้อง, เนื้อหาต้องปรับปรุง..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {totalAnnotated > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 flex-1">
                    annotation {totalAnnotated} ไฟล์ถูกบันทึกแล้ว
                  </span>
                  {hasAnnotatableFiles && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowReasonInput(false);
                        setShowFileList(true);
                      }}
                    >
                      <PenTool className="h-3 w-3 mr-1" /> แก้ไข
                    </Button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                  disabled={isLoading}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  className="flex-1"
                  disabled={isLoading || !rejectionReason.trim()}
                >
                  {isLoading ? 'กำลังตีกลับ...' : 'ยืนยันตีกลับ'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotation Editor Modal */}
      {editingFileUrl && (
        <PDFAnnotationEditor
          pdfUrl={editingFileUrl}
          isOpen={showAnnotationEditor}
          onClose={() => {
            setShowAnnotationEditor(false);
            setEditingFileUrl(null);
          }}
          onSave={handleAnnotationSave}
          isSaving={isSavingAnnotation}
        />
      )}
    </>
  );
};
