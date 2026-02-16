import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ApprovalActionProps {
  canApprove: boolean;
  loading: boolean;
  onApproval: (action: 'approve' | 'reject', comment: string) => void;
}

const ApprovalAction: React.FC<ApprovalActionProps> = ({
  canApprove,
  loading,
  onApproval
}) => {
  const [comment, setComment] = useState('');

  const handleApproval = (action: 'approve' | 'reject') => {
    onApproval(action, comment);
    setComment('');
  };

  if (!canApprove) return null;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <Label className="text-base font-medium">ดำเนินการอนุมัติ</Label>
      <div>
        <Label htmlFor="comment">ความเห็น *</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="กรุณาระบุความเห็น..."
          rows={3}
          className="mt-1"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={() => handleApproval('approve')}
          disabled={loading || !comment.trim()}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          อนุมัติ
        </Button>
        <Button 
          variant="destructive"
          onClick={() => handleApproval('reject')}
          disabled={loading || !comment.trim()}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          ปฏิเสธ
        </Button>
      </div>
    </div>
  );
};

export default ApprovalAction;