import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RejectionCardProps {
  onReject: (reason: string) => void;
  isLoading?: boolean;
}

export const RejectionCard: React.FC<RejectionCardProps> = ({ onReject, isLoading = false }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
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

    onReject(rejectionReason.trim());
    setRejectionReason('');
    setShowReasonInput(false);
  };

  const handleCancel = () => {
    setRejectionReason('');
    setShowReasonInput(false);
  };

  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          ตีกลับเอกสาร
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showReasonInput ? (
          <div className="text-center">
            <p className="text-sm text-red-600 mb-4">
              หากพบปัญหาหรือข้อผิดพลาดในเอกสาร สามารถตีกลับเพื่อให้ผู้เขียนแก้ไขได้
            </p>
            <Button 
              variant="destructive" 
              onClick={() => setShowReasonInput(true)}
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
  );
};