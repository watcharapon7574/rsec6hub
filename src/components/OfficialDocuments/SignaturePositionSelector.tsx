import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, RotateCcw } from 'lucide-react';

interface SignaturePosition {
  x: number;
  y: number;
  page: number;
  signerIndex: number;
}

interface SignaturePositionSelectorProps {
  pdfUrl?: string;
  signers: any[];
  onPositionsChange: (positions: SignaturePosition[]) => void;
}

const SignaturePositionSelector: React.FC<SignaturePositionSelectorProps> = ({
  pdfUrl,
  signers,
  onPositionsChange
}) => {
  const [positions, setPositions] = useState<SignaturePosition[]>([]);
  const [currentSignerIndex, setCurrentSignerIndex] = useState(0);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pdfUrl) {
      loadPDF();
    }
  }, [pdfUrl]);

  useEffect(() => {
    onPositionsChange(positions);
  }, [positions, onPositionsChange]);

  const loadPDF = async () => {
    try {
      // สร้าง PDF viewer อย่างง่าย - ในการใช้งานจริงใช้ PDF.js
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // สีพื้นหลังขาว (จำลอง PDF)
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // เส้นขอบ
          ctx.strokeStyle = '#ccc';
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
          
          // ข้อความตัวอย่าง
          ctx.fillStyle = '#333';
          ctx.font = '16px Arial';
          ctx.fillText('PDF Document Preview', 50, 50);
          ctx.fillText('(คลิกเพื่อวางจุดลายเซ็น)', 50, 80);
          
          setPdfLoaded(true);
        }
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pdfLoaded || currentSignerIndex >= signers.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // แปลงเป็นเปอร์เซ็นต์สำหรับความยืดหยุ่น
    const xPercent = (x / canvas.width) * 100;
    const yPercent = (y / canvas.height) * 100;

    const newPosition: SignaturePosition = {
      x: xPercent,
      y: yPercent,
      page: 1, // สำหรับตัวอย่างใช้หน้า 1
      signerIndex: currentSignerIndex
    };

    // ลบ position เดิมของ signer คนนี้ (ถ้ามี)
    const updatedPositions = positions.filter(p => p.signerIndex !== currentSignerIndex);
    updatedPositions.push(newPosition);
    
    setPositions(updatedPositions);

    // ไปยัง signer คนถัดไป
    if (currentSignerIndex < signers.length - 1) {
      setCurrentSignerIndex(currentSignerIndex + 1);
    }
  };

  const renderSignatureMarkers = () => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfLoaded) return null;

    return positions.map((position, index) => {
      const signer = signers[position.signerIndex];
      if (!signer) return null;

      const x = (position.x / 100) * canvas.width;
      const y = (position.y / 100) * canvas.height;

      return (
        <div
          key={`${signer.user_id}-${index}`}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: x,
            top: y,
          }}
        >
          <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {position.signerIndex + 1}
          </div>
        </div>
      );
    });
  };

  const resetPositions = () => {
    setPositions([]);
    setCurrentSignerIndex(0);
  };

  const getCurrentSigner = () => {
    return signers[currentSignerIndex];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            วางจุดลายเซ็น
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetPositions}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            รีเซ็ต
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* สถานะปัจจุบัน */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            กำลังกำหนดตำแหน่งสำหรับ: 
          </p>
          {getCurrentSigner() ? (
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
              {getCurrentSigner().first_name} {getCurrentSigner().last_name} 
              (ลำดับที่ {currentSignerIndex + 1})
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
              เสร็จสิ้นแล้ว
            </Badge>
          )}
        </div>

        {/* PDF Viewer */}
        <div 
          ref={containerRef}
          className="relative border border-border rounded-lg overflow-hidden"
          style={{ minHeight: '400px' }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full h-auto cursor-crosshair"
            onClick={handleCanvasClick}
          />
          {renderSignatureMarkers()}
        </div>

        {/* คำแนะนำ */}
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">คำแนะนำ:</p>
          <ul className="space-y-1 text-xs">
            <li>• คลิกบน PDF เพื่อวางจุดลายเซ็น</li>
            <li>• จุดสีแดงแสดงตำแหน่งที่เลือก</li>
            <li>• สามารถคลิกใหม่เพื่อเปลี่ยนตำแหน่งได้</li>
          </ul>
        </div>

        {/* สรุปตำแหน่งที่วางแล้ว */}
        <div className="space-y-2">
          <p className="font-medium text-sm">ตำแหน่งที่วางแล้ว:</p>
          <div className="grid grid-cols-1 gap-2">
            {signers.map((signer, index) => {
              const position = positions.find(p => p.signerIndex === index);
              return (
                <div 
                  key={signer.user_id}
                  className={`p-2 border rounded text-xs ${
                    position ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-muted border-border'
                  }`}
                >
                  <span className="font-medium">
                    {index + 1}. {signer.first_name} {signer.last_name}
                  </span>
                  {position ? (
                    <span className="text-green-600 dark:text-green-400 dark:text-green-600 ml-2">✓ วางแล้ว</span>
                  ) : (
                    <span className="text-muted-foreground ml-2">รอวางตำแหน่ง</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignaturePositionSelector;