
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle, 
  MessageSquare, 
  Clock,
  Eye,
  PenTool,
  Download
} from 'lucide-react';

interface PendingDocument {
  id: string;
  fileName: string;
  submittedBy: string;
  submittedAt: string;
  currentApprover: string;
  status: 'pending_approval' | 'approved' | 'signed';
  comments: { approver: string; comment: string; timestamp: string }[];
}

const ClerkSigningTools: React.FC = () => {
  const [pendingDocuments] = useState<PendingDocument[]>([
    {
      id: '1',
      fileName: 'หนังสือขออนุมัติงบประมาณ.pdf',
      submittedBy: 'นางสาวอรุณ ใจดี',
      submittedAt: '2024-01-15 09:30',
      currentApprover: 'รองผู้อำนวยการ 1',
      status: 'pending_approval',
      comments: []
    },
    {
      id: '2',
      fileName: 'รายงานการใช้จ่ายไตรมาส 1.pdf',
      submittedBy: 'นายสมชาย รักเรียน',
      submittedAt: '2024-01-14 14:15',
      currentApprover: 'ผู้อำนวยการ',
      status: 'approved',
      comments: [
        { approver: 'รองผู้อำนวยการ 1', comment: 'เห็นชอบตามที่เสนอ', timestamp: '2024-01-14 15:30' },
        { approver: 'รองผู้อำนวยการ 2', comment: 'อนุมัติ', timestamp: '2024-01-15 08:45' }
      ]
    }
  ]);

  const [selectedDocument, setSelectedDocument] = useState<PendingDocument | null>(null);
  const [comment, setComment] = useState('');

  const handleApprove = (docId: string) => {
    console.log('Approving document:', docId, 'with comment:', comment);
    setComment('');
  };

  const handleSign = (docId: string) => {
    console.log('Signing document:', docId);
  };

  const handleDownloadPDF = (docId: string) => {
    console.log('Downloading signed PDF:', docId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 dark:text-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:text-blue-200';
      case 'signed':
        return 'bg-green-100 text-green-800 dark:text-green-200';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'รอการอนุมัติ';
      case 'approved':
        return 'อนุมัติแล้ว - รอลงนาม';
      case 'signed':
        return 'ลงนามเสร็จสิ้น';
      default:
        return 'ไม่ทราบสถานะ';
    }
  };

  return (
    <Card className="bg-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          เครื่องมือธุรการ - การลงนามเอกสาร
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Document Queue */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            เอกสารรอดำเนินการ ({pendingDocuments.length})
          </h3>
          
          <div className="space-y-3">
            {pendingDocuments.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-4 hover:bg-muted transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-muted-foreground mb-1">{doc.fileName}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>ส่งโดย: {doc.submittedBy}</p>
                      <p>เวลา: {doc.submittedAt}</p>
                      <p>ผู้อนุมัติปัจจุบัน: {doc.currentApprover}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadge(doc.status)}`}>
                    {getStatusText(doc.status)}
                  </span>
                </div>

                {/* Comments History */}
                {doc.comments.length > 0 && (
                  <div className="bg-muted rounded p-3 mb-3">
                    <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      ความเห็นการอนุมัติ
                    </h5>
                    <div className="space-y-2">
                      {doc.comments.map((comment, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-foreground">{comment.approver}</div>
                          <div className="text-muted-foreground">{comment.comment}</div>
                          <div className="text-xs text-muted-foreground">{comment.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setSelectedDocument(doc)}>
                    <Eye className="h-4 w-4 mr-1" />
                    ดูตัวอย่าง
                  </Button>
                  
                  {doc.status === 'pending_approval' && (
                    <Button size="sm" variant="default" onClick={() => handleApprove(doc.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      อนุมัติ
                    </Button>
                  )}
                  
                  {doc.status === 'approved' && (
                    <Button size="sm" variant="default" onClick={() => handleSign(doc.id)}>
                      <PenTool className="h-4 w-4 mr-1" />
                      ลงนาม
                    </Button>
                  )}
                  
                  {doc.status === 'signed' && (
                    <Button size="sm" variant="secondary" onClick={() => handleDownloadPDF(doc.id)}>
                      <Download className="h-4 w-4 mr-1" />
                      ดาวน์โหลด PDF
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comment Section for Approval */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            เพิ่มความเห็น
          </h3>
          <div className="space-y-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ระบุความเห็นในการอนุมัติ..."
              className="w-full p-3 border rounded-lg resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              ความเห็นจะถูกแสดงใกล้กับตำแหน่งลายเซ็นในเอกสาร PDF
            </p>
          </div>
        </div>

        {/* Signature Management */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            จัดการลายเซ็น
          </h3>
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">ลายเซ็นดิจิทัล</p>
            <div className="flex items-center gap-3">
              <div className="w-24 h-12 bg-card border-2 border-dashed border-blue-300 dark:border-blue-700 rounded flex items-center justify-center">
                <span className="text-xs text-blue-600">ลายเซ็น</span>
              </div>
              <Button size="sm" variant="outline">
                อัพโหลดลายเซ็น PNG
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {pendingDocuments.filter(d => d.status === 'pending_approval').length}
            </div>
            <div className="text-sm text-muted-foreground">รอการอนุมัติ</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {pendingDocuments.filter(d => d.status === 'approved').length}
            </div>
            <div className="text-sm text-muted-foreground">รอลงนาม</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {pendingDocuments.filter(d => d.status === 'signed').length}
            </div>
            <div className="text-sm text-muted-foreground">เสร็จสิ้น</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClerkSigningTools;
