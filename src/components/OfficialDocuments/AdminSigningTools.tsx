
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileText, 
  Users, 
  MapPin,
  Settings,
  Eye,
  Download
} from 'lucide-react';

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
}

interface ApprovalPath {
  id: string;
  name: string;
  position: string;
  order: number;
}

interface DocumentWorkflow {
  id: string;
  fileName: string;
  fileUrl: string;
  signaturePositions: SignaturePosition[];
  approvalPath: ApprovalPath[];
  currentStep: number;
  status: 'pending' | 'in_progress' | 'completed';
  comments: { approver: string; comment: string; timestamp: string }[];
}

const AdminSigningTools: React.FC = () => {
  const [workflows, setWorkflows] = useState<DocumentWorkflow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signaturePositions, setSignaturePositions] = useState<SignaturePosition[]>([]);
  const [approvalPath, setApprovalPath] = useState<ApprovalPath[]>([
    { id: '1', name: 'รองผู้อำนวยการ 1', position: 'deputy_director', order: 1 },
    { id: '2', name: 'รองผู้อำนวยการ 2', position: 'deputy_director', order: 2 },
    { id: '3', name: 'ผู้อำนวยการ', position: 'director', order: 3 }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      console.log('PDF file selected:', file.name);
    }
  };

  const handlePositionClick = (page: number, x: number, y: number) => {
    const newPosition: SignaturePosition = { page, x, y };
    setSignaturePositions([...signaturePositions, newPosition]);
    console.log('Signature position added:', newPosition);
  };

  const createWorkflow = () => {
    if (!selectedFile) return;

    const newWorkflow: DocumentWorkflow = {
      id: crypto.randomUUID(),
      fileName: selectedFile.name,
      fileUrl: URL.createObjectURL(selectedFile),
      signaturePositions,
      approvalPath,
      currentStep: 0,
      status: 'pending',
      comments: []
    };

    setWorkflows([...workflows, newWorkflow]);
    setSelectedFile(null);
    setSignaturePositions([]);
    console.log('Workflow created:', newWorkflow);
  };

  const removePosition = (index: number) => {
    setSignaturePositions(signaturePositions.filter((_, i) => i !== index));
  };

  return (
    <Card className="bg-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          เครื่องมือผู้บริหาร - ระบบลงนามเอกสาร
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* File Upload Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Upload className="h-4 w-4" />
            อัพโหลดเอกสาร PDF
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mb-2"
            >
              <Upload className="h-4 w-4 mr-2" />
              เลือกไฟล์ PDF
            </Button>
            {selectedFile && (
              <p className="text-sm text-green-600 mt-2">
                ไฟล์ที่เลือก: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Signature Positions */}
        {selectedFile && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              กำหนดตำแหน่งลายเซ็น
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                คลิกบนตัวอย่าง PDF เพื่อกำหนดตำแหน่งลายเซ็น
              </p>
              <div className="space-y-2">
                {signaturePositions.map((pos, index) => (
                  <div key={index} className="flex items-center justify-between bg-card p-2 rounded border">
                    <span className="text-sm">
                      หน้า {pos.page}, X: {pos.x}, Y: {pos.y}
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removePosition(index)}
                    >
                      ลบ
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Approval Path */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            เส้นทางการอนุมัติ
          </h3>
          <div className="space-y-2">
            {approvalPath.map((approver, index) => (
              <div key={approver.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{approver.name}</div>
                  <div className="text-sm text-muted-foreground">{approver.job_position || approver.position}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Workflow Button */}
        {selectedFile && signaturePositions.length > 0 && (
          <Button 
            onClick={createWorkflow}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            สร้างเวิร์กโฟลว์การลงนาม
          </Button>
        )}

        {/* Active Workflows */}
        {workflows.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">เวิร์กโฟลว์ที่ดำเนินการ</h3>
            {workflows.map((workflow) => (
              <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{workflow.fileName}</h4>
                  <span className={`px-2 py-1 rounded text-sm ${
                    workflow.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    workflow.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {workflow.status === 'pending' ? 'รอการอนุมัติ' :
                     workflow.status === 'in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น'}
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  ขั้นตอนปัจจุบัน: {workflow.currentStep + 1}/{workflow.approvalPath.length}
                  {workflow.currentStep < workflow.approvalPath.length && (
                    <span className="ml-2 font-medium">
                      ({workflow.approvalPath[workflow.currentStep]?.name})
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-1" />
                    ดูตัวอย่าง
                  </Button>
                  {workflow.status === 'completed' && (
                    <Button size="sm" variant="default">
                      <Download className="h-4 w-4 mr-1" />
                      ดาวน์โหลด PDF
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminSigningTools;
