import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, MessageCircle, PenTool, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PDFAnnotationEditor from './PDFAnnotationEditor';
import { uploadAnnotatedPdf } from '@/utils/pdfAnnotationUtils';

interface RejectionCardProps {
  onReject: (reason: string, annotatedPdfUrl?: string) => void;
  isLoading?: boolean;
  pdfUrl?: string;
  documentId?: string;
  userId?: string;
}

export const RejectionCard: React.FC<RejectionCardProps> = ({
  onReject,
  isLoading = false,
  pdfUrl,
  documentId,
  userId,
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [annotatedPdfUrl, setAnnotatedPdfUrl] = useState<string | null>(null);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const { toast } = useToast();

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "กรุณาระบุเหตุผล",
        description: "กรุณาระบุเหตุผลการตีกลับเอกสาร",
        variant: "destructive",
      });
      return;
    }

    onReject(rejectionReason.trim(), annotatedPdfUrl || undefined);
    setRejectionReason('');
    setShowReasonInput(false);
    setAnnotatedPdfUrl(null);
  };

  const handleCancel = () => {
    setRejectionReason('');
    setShowReasonInput(false);
    setAnnotatedPdfUrl(null);
  };

  const handleAnnotationSave = async (blob: Blob) => {
    if (!documentId || !userId) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่พบข้อมูลเอกสาร",
        variant: "destructive",
      });
      return;
    }

    setIsSavingAnnotation(true);
    try {
      const url = await uploadAnnotatedPdf(blob, documentId, userId);
      setAnnotatedPdfUrl(url);
      setShowAnnotationEditor(false);
      setShowReasonInput(true);
      toast({
        title: "บันทึก annotation สำเร็จ",
        description: "กรุณาระบุเหตุผลแล้วกดยืนยันตีกลับ",
      });
    } catch (error) {
      console.error('Error uploading annotated PDF:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึก annotation ได้",
        variant: "destructive",
      });
    } finally {
      setIsSavingAnnotation(false);
    }
  };

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
          {!showReasonInput ? (
            <div className="text-center">
              <p className="text-sm text-red-600 dark:text-red-400 dark:text-red-600 mb-4">
                หากพบปัญหาหรือข้อผิดพลาดในเอกสาร สามารถตีกลับเพื่อให้ผู้เขียนแก้ไขได้
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  if (pdfUrl && documentId && userId) {
                    setShowAnnotationEditor(true);
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
          ) : (
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

              {/* Annotation button - only show if pdfUrl is available */}
              {pdfUrl && documentId && userId && (
                <div>
                  {annotatedPdfUrl ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-700 flex-1">annotation ถูกบันทึกแล้ว</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAnnotationEditor(true)}
                      >
                        <PenTool className="h-4 w-4 mr-1" /> แก้ไข
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowAnnotationEditor(true)}
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      ขีดเขียนบนเอกสาร (ไม่บังคับ)
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
      {pdfUrl && (
        <PDFAnnotationEditor
          pdfUrl={pdfUrl}
          isOpen={showAnnotationEditor}
          onClose={() => {
            setShowAnnotationEditor(false);
            setShowReasonInput(true);
          }}
          onSave={handleAnnotationSave}
          isSaving={isSavingAnnotation}
        />
      )}
    </>
  );
};
