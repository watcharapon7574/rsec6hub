import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Send } from 'lucide-react';

interface Step4Props {
  memo: any;
  documentNumber: string;
  signers: any[];
  signaturePositions: any[];
  onPositionRemove: (index: number) => void;
  onPrevious: () => void;
  onSubmit: () => void;
}

const Step4Review: React.FC<Step4Props> = ({
  memo,
  documentNumber,
  signers,
  signaturePositions,
  onPositionRemove,
  onPrevious,
  onSubmit
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          ตรวจสอบและส่งเสนอ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3">ข้อมูลเอกสาร</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">เรื่อง:</span>
                <span className="font-medium">{memo.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">เลขหนังสือ:</span>
                <span className="font-medium">{documentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้เขียน:</span>
                <span className="font-medium">{memo.author_name}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3">ผู้ลงนาม</h3>
            <div className="space-y-2">
              {signers.map((signer, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="mt-0.5">{signer.order}</Badge>
                  <div className="flex-1">
                    <p className="font-semibold">{signer.name}</p>
                    {/* job_position (เล็กสุด) */}
                    <p className="text-xs text-muted-foreground">
                      {signer.role === 'author' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                      {signer.role === 'assistant_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                      {signer.role === 'deputy_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}${signer.academic_rank ? ` วิทยฐานะ ${signer.academic_rank}` : ''}`}
                      {signer.role === 'director' && `${signer.job_position || signer.position || ''}`}
                    </p>
                    {/* org_structure_role (เด่นรอง) */}
                    {(signer.role === 'assistant_director' || signer.role === 'deputy_director' || signer.role === 'director') && signer.org_structure_role && (
                      <p className="text-sm text-muted-foreground">
                        {signer.org_structure_role}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-medium mb-3">ตำแหน่งลายเซ็นที่กำหนด</h3>
          <div className="space-y-2">
            {signaturePositions.map((pos, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{pos.signer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    หน้า {pos.page} ตำแหน่ง ({Math.round(pos.x)}, {Math.round(pos.y)})
                  </p>
                  {pos.comment && (
                    <p className="text-sm text-foreground">ความเห็น: {pos.comment}</p>
                  )}
                </div>
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => onPositionRemove(index)}
                >
                  ลบ
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onPrevious}>
            ก่อนหน้า
          </Button>
          <Button onClick={onSubmit} className="bg-green-600 hover:bg-green-700">
            <Send className="h-4 w-4 mr-2" />
            ส่งเสนอ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step4Review;
