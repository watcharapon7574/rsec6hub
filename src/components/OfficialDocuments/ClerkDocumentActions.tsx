import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  FileText,
  Users,
  MapPin,
  Send,
  ClipboardList
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import PDFViewer from './PDFViewer';
import SignaturePositionSelector from './SignaturePositionSelector';

interface ClerkDocumentActionsProps {
  documentId: string;
  documentTitle: string;
  documentType: 'memo' | 'doc_receive';
  currentSignerOrder?: number;
  isAssigned?: boolean;
  pdfUrl?: string;
  onReject: (documentId: string, reason: string) => void;
  onAssignNumber: (documentId: string, number: string) => void;
  onSetSigners: (documentId: string, signers: any[]) => void;
}

const ClerkDocumentActions: React.FC<ClerkDocumentActionsProps> = ({
  documentId,
  documentTitle,
  documentType,
  currentSignerOrder,
  isAssigned = false,
  pdfUrl,
  onReject,
  onAssignNumber,
  onSetSigners
}) => {
  const navigate = useNavigate();
  const [rejectReason, setRejectReason] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedSigners, setSelectedSigners] = useState<any[]>([]);
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('reject');
  
  const { toast } = useToast();
  const { profiles } = useProfiles();

  // กรองเฉพาะผู้บริหาร
  const executives = profiles.filter(profile => 
    ['director', 'deputy_director', 'assistant_director'].includes(profile.position)
  );

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast({
        title: "กรุณาระบุเหตุผล",
        description: "กรุณาใส่เหตุผลในการตีกลับเอกสาร",
        variant: "destructive",
      });
      return;
    }
    onReject(documentId, rejectReason);
    setRejectReason('');
  };

  const handleAssignNumber = () => {
    if (!documentNumber.trim()) {
      toast({
        title: "กรุณาระบุเลขหนังสือ",
        description: "กรุณาใส่เลขหนังสือราชการ",
        variant: "destructive",
      });
      return;
    }
    onAssignNumber(documentId, documentNumber);
    setDocumentNumber('');
  };

  const handleSetSigners = () => {
    if (selectedSigners.length === 0) {
      toast({
        title: "กรุณาเลือกผู้ลงนาม",
        description: "กรุณาเลือกผู้ลงนามอย่างน้อย 1 คน",
        variant: "destructive",
      });
      return;
    }
    
    if (signaturePositions.length !== selectedSigners.length) {
      toast({
        title: "กรุณาวางจุดลายเซ็น",
        description: "กรุณาวางจุดลายเซ็นให้ครบทุกคน",
        variant: "destructive",
      });
      return;
    }

    onSetSigners(documentId, selectedSigners.map((signer, index) => ({
      ...signer,
      ...signaturePositions[index]
    })));
    setSelectedSigners([]);
    setSignaturePositions([]);
  };

  const addSigner = (profile: any) => {
    if (selectedSigners.find(s => s.user_id === profile.user_id)) return;
    setSelectedSigners([...selectedSigners, profile]);
  };

  const removeSigner = (userId: string) => {
    setSelectedSigners(selectedSigners.filter(s => s.user_id !== userId));
    // ลบ position ที่เกี่ยวข้องด้วย
    setSignaturePositions(signaturePositions.filter((_, index) => 
      selectedSigners[index]?.user_id !== userId
    ));
  };

  // เช็คว่าเอกสารเกษียนหนังสือแล้วหรือยัง (current_signer_order = 5)
  // และยังไม่ได้มอบหมายงาน (is_assigned = false)
  const isDocumentCompleted = currentSignerOrder === 5;
  const canAssignTask = isDocumentCompleted && !isAssigned;

  // ถ้าเอกสารเกษียนแล้วและยังไม่ได้มอบหมาย ให้แสดงปุ่ม "มอบหมายงาน"
  if (canAssignTask) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigate(`/task-assignment?documentId=${documentId}&documentType=${documentType}`);
          }}
          className="bg-green-50 dark:bg-green-950 border-green-500 text-foreground hover:bg-green-100"
        >
          <ClipboardList className="h-4 w-4 mr-1" />
          มอบหมายงาน
        </Button>
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
          ใหม่
        </span>
      </div>
    );
  }

  // ถ้าเอกสารมอบหมายแล้ว แสดงปุ่มสถานะ "มอบหมายแล้ว" (disabled)
  if (isDocumentCompleted && isAssigned) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="bg-muted border-border text-muted-foreground cursor-not-allowed"
      >
        <ClipboardList className="h-4 w-4 mr-1" />
        มอบหมายแล้ว
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          จัดการเอกสาร
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            จัดการเอกสาร: {documentTitle}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reject" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              ตีกลับ
            </TabsTrigger>
            <TabsTrigger value="number" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              ลงเลขหนังสือ
            </TabsTrigger>
            <TabsTrigger value="signers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              กำหนดผู้ลงนาม
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              วางจุดลายเซ็น
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reject" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">ตีกลับเอกสาร</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="reject-reason">เหตุผลในการตีกลับ</Label>
                  <Textarea
                    id="reject-reason"
                    placeholder="กรุณาระบุเหตุผลที่ต้องการให้ผู้สร้างแก้ไข..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <Button 
                  onClick={handleReject} 
                  variant="destructive"
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  ตีกลับเอกสาร
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="number" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">ลงเลขหนังสือราชการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="doc-number">เลขหนังสือราชการ</Label>
                  <Input
                    id="doc-number"
                    placeholder="เช่น ศษ.6/001/2567"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleAssignNumber} 
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  ลงเลขหนังสือ
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signers" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">เลือกผู้ลงนาม</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executives.map((profile) => (
                      <div 
                        key={profile.user_id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => addSigner(profile)}
                      >
                        <div>
                          <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                          <p className="text-sm text-muted-foreground">{profile.job_position || profile.current_position || profile.position}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant={selectedSigners.find(s => s.user_id === profile.user_id) ? "default" : "outline"}
                        >
                          {selectedSigners.find(s => s.user_id === profile.user_id) ? "เลือกแล้ว" : "เลือก"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-purple-600">ผู้ลงนามที่เลือก</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedSigners.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">ยังไม่ได้เลือกผู้ลงนาม</p>
                    ) : (
                      selectedSigners.map((signer, index) => (
                        <div key={signer.user_id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
                          <div>
                            <p className="font-medium">{signer.first_name} {signer.last_name}</p>
                            <p className="text-sm text-muted-foreground">ลำดับที่ {index + 1}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => removeSigner(signer.user_id)}
                          >
                            ลบ
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            {pdfUrl ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <SignaturePositionSelector
                    pdfUrl={pdfUrl}
                    signers={selectedSigners}
                    onPositionsChange={setSignaturePositions}
                  />
                </div>
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>สรุปการกำหนด</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {selectedSigners.map((signer, index) => {
                          const position = signaturePositions[index];
                          return (
                            <div key={signer.user_id} className="p-3 border rounded-lg">
                              <p className="font-medium">{signer.first_name} {signer.last_name}</p>
                              <p className="text-sm text-muted-foreground">{signer.job_position || signer.current_position || signer.position}</p>
                              {position ? (
                                <p className="text-xs text-green-600">✓ กำหนดตำแหน่งแล้ว</p>
                              ) : (
                                <p className="text-xs text-muted-foreground">! ยังไม่ได้กำหนดตำแหน่ง</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <Button 
                        onClick={handleSetSigners}
                        className="w-full"
                        disabled={signaturePositions.length !== selectedSigners.length}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        ส่งเข้าสู่กระบวนการลงนาม
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">ไม่มีไฟล์ PDF สำหรับวางจุดลายเซ็น</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClerkDocumentActions;