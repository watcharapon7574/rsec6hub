import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Canvas as FabricCanvas, Rect, Textbox } from 'fabric';
import { Users, MapPin, Move, RotateCcw, Save, MousePointer } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SignaturePosition {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
}

interface DocumentFormData {
  subject: string;
  date: Date | null;
  attachment: File | null;
  content: {
    introduction: string;
    facts: string;
    recommendation: string;
  };
  signers: {
    assistant: string;
    deputy: string;
    director: string;
  };
  signaturePositions: SignaturePosition[];
}

interface InteractivePreviewProps {
  formData: DocumentFormData;
  signaturePositions: SignaturePosition[];
  onPositionUpdate: (positions: SignaturePosition[]) => void;
  onDocumentClick?: (x: number, y: number) => void;
  isClickMode?: boolean;
  pendingSigner?: {id: string, name: string, position: string};
}

const InteractivePreview: React.FC<InteractivePreviewProps> = ({
  formData,
  signaturePositions,
  onPositionUpdate,
  onDocumentClick,
  isClickMode = false,
  pendingSigner
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);

  // A4 dimensions in pixels (at 96 DPI)
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  useEffect(() => {
    if (!canvasRef.current) return;

    // Dispose previous canvas if exists
    if (fabricCanvas) {
      fabricCanvas.dispose();
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width: A4_WIDTH,
      height: A4_HEIGHT,
      backgroundColor: '#ffffff',
      selection: isInteractiveMode && !isClickMode
    });

    // Draw document content
    drawDocumentContent(canvas);
    
    // Add signature boxes if in interactive mode and positions exist
    if (isInteractiveMode && signaturePositions.length > 0 && !isClickMode) {
      addSignatureBoxes(canvas);
    } else if (signaturePositions.length > 0) {
      addStaticSignatureBoxes(canvas);
    }

    // Handle canvas clicks for position selection
    if (isClickMode && onDocumentClick) {
      canvas.on('mouse:down', (event) => {
        const pointer = canvas.getPointer(event.e);
        onDocumentClick(pointer.x, pointer.y);
      });
    }

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [isInteractiveMode, formData, signaturePositions, isClickMode, onDocumentClick]);

  const drawDocumentContent = (canvas: FabricCanvas) => {
    try {
      // School header
      const schoolHeader = new Textbox('โรงเรียนตัวอย่าง', {
        left: A4_WIDTH / 2,
        top: 50,
        width: 300,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        selectable: false,
        evented: false,
        originX: 'center'
      });
      canvas.add(schoolHeader);

      const docTypeHeader = new Textbox('บันทึกข้อความ', {
        left: A4_WIDTH / 2,
        top: 80,
        width: 200,
        fontSize: 14,
        textAlign: 'center',
        selectable: false,
        evented: false,
        originX: 'center'
      });
      canvas.add(docTypeHeader);

      // Subject and Date
      const subjectText = new Textbox(`เรื่อง: ${formData.subject || 'ระบุหัวข้อเรื่อง'}`, {
        left: 60,
        top: 130,
        width: 400,
        fontSize: 12,
        selectable: false,
        evented: false
      });
      canvas.add(subjectText);

      const dateText = new Textbox(`วันที่: ${formData.date ? format(formData.date, 'dd/MM/yyyy') : 'เลือกวันที่'}`, {
        left: 500,
        top: 130,
        width: 200,
        fontSize: 12,
        selectable: false,
        evented: false
      });
      canvas.add(dateText);

      // Content sections
      let currentY = 180;

      if (formData.content.introduction) {
        const introTitle = new Textbox('ต้นเรื่อง:', {
          left: 60,
          top: currentY,
          width: 100,
          fontSize: 12,
          fontWeight: 'bold',
          selectable: false,
          evented: false
        });
        canvas.add(introTitle);

        const introContent = new Textbox(formData.content.introduction, {
          left: 100,
          top: currentY + 25,
          width: 600,
          fontSize: 11,
          selectable: false,
          evented: false
        });
        canvas.add(introContent);
        currentY += 100;
      }

      if (formData.content.facts) {
        const factsTitle = new Textbox('ข้อเท็จจริง:', {
          left: 60,
          top: currentY,
          width: 120,
          fontSize: 12,
          fontWeight: 'bold',
          selectable: false,
          evented: false
        });
        canvas.add(factsTitle);

        const factsContent = new Textbox(formData.content.facts, {
          left: 100,
          top: currentY + 25,
          width: 600,
          fontSize: 11,
          selectable: false,
          evented: false
        });
        canvas.add(factsContent);
        currentY += 120;
      }

      if (formData.content.recommendation) {
        const recTitle = new Textbox('ข้อเสนอและพิจารณา:', {
          left: 60,
          top: currentY,
          width: 200,
          fontSize: 12,
          fontWeight: 'bold',
          selectable: false,
          evented: false
        });
        canvas.add(recTitle);

        const recContent = new Textbox(formData.content.recommendation, {
          left: 100,
          top: currentY + 25,
          width: 600,
          fontSize: 11,
          selectable: false,
          evented: false
        });
        canvas.add(recContent);
      }

      canvas.renderAll();
    } catch (error) {
      console.error('Error drawing document content:', error);
    }
  };

  const addSignatureBoxes = (canvas: FabricCanvas) => {
    try {
      signaturePositions.forEach((pos) => {
        // Create signature box
        const signatureBox = new Rect({
          left: pos.x,
          top: pos.y,
          width: 120,
          height: 80,
          fill: 'rgba(59, 130, 246, 0.1)',
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: true,
          hasControls: true,
          hasBorders: true
        });

        // Add label
        const label = new Textbox(`${pos.position}\n${pos.name}`, {
          left: pos.x + 5,
          top: pos.y + 5,
          width: 110,
          height: 70,
          fontSize: 10,
          textAlign: 'center',
          selectable: false,
          evented: false,
          fill: '#1e40af'
        });

        // Store position data
        signatureBox.set('positionId', pos.id);
        
        // Handle position updates
        signatureBox.on('moving', () => {
          updateSignaturePosition(pos.id, signatureBox.left || 0, signatureBox.top || 0);
          label.set({
            left: (signatureBox.left || 0) + 5,
            top: (signatureBox.top || 0) + 5
          });
          canvas.renderAll();
        });

        signatureBox.on('modified', () => {
          updateSignaturePosition(pos.id, signatureBox.left || 0, signatureBox.top || 0);
          label.set({
            left: (signatureBox.left || 0) + 5,
            top: (signatureBox.top || 0) + 5
          });
          canvas.renderAll();
        });

        canvas.add(signatureBox);
        canvas.add(label);
      });

      canvas.renderAll();
    } catch (error) {
      console.error('Error adding signature boxes:', error);
    }
  };

  const addStaticSignatureBoxes = (canvas: FabricCanvas) => {
    try {
      signaturePositions.forEach((pos) => {
        // Create static signature box
        const signatureBox = new Rect({
          left: pos.x,
          top: pos.y,
          width: 120,
          height: 80,
          fill: 'rgba(34, 197, 94, 0.1)',
          stroke: '#22c55e',
          strokeWidth: 2,
          selectable: false,
          evented: false
        });

        // Add label
        const label = new Textbox(`${pos.position}\n${pos.name}`, {
          left: pos.x + 5,
          top: pos.y + 5,
          width: 110,
          height: 70,
          fontSize: 10,
          textAlign: 'center',
          selectable: false,
          evented: false,
          fill: '#15803d'
        });

        canvas.add(signatureBox);
        canvas.add(label);
      });

      canvas.renderAll();
    } catch (error) {
      console.error('Error adding static signature boxes:', error);
    }
  };

  const updateSignaturePosition = (id: string, x: number, y: number) => {
    const updatedPositions = signaturePositions.map(pos => 
      pos.id === id ? { ...pos, x, y } : pos
    );
    onPositionUpdate(updatedPositions);
  };

  const toggleInteractiveMode = () => {
    setIsInteractiveMode(!isInteractiveMode);
  };

  const resetPositions = () => {
    const resetPositions = signaturePositions.map((pos, index) => ({
      ...pos,
      x: 150 + (index * 200),
      y: 700
    }));
    onPositionUpdate(resetPositions);
  };

  const savePositions = () => {
    console.log('Saving signature positions:', signaturePositions);
    setIsInteractiveMode(false);
  };

  // Show message if no signature positions
  if (signaturePositions.length === 0 && !isClickMode) {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            ตัวอย่างเอกสาร A4
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <div className="text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">ยังไม่มีตำแหน่งลายเซ็น</h3>
            <p className="text-sm">กรุณากลับไปที่ขั้นตอนที่ 3 เพื่อสร้างตำแหน่งลายเซ็นก่อน</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            ตัวอย่างเอกสาร A4
            {isClickMode && (
              <Badge variant="secondary" className="ml-2 bg-white text-blue-600">
                <MousePointer className="h-3 w-3 mr-1" />
                โหมดเลือกตำแหน่ง
              </Badge>
            )}
          </CardTitle>
          {!isClickMode && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={isInteractiveMode ? "secondary" : "outline"}
                onClick={toggleInteractiveMode}
                className="text-white border-white hover:bg-white hover:text-blue-600"
              >
                <Move className="h-4 w-4 mr-1" />
                {isInteractiveMode ? 'ปิดโหมดแก้ไข' : 'แก้ไขตำแหน่ง'}
              </Button>
              {isInteractiveMode && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetPositions}
                    className="text-white border-white hover:bg-white hover:text-blue-600"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    รีเซ็ต
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={savePositions}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    บันทึก
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Click Mode Instructions */}
        {isClickMode && pendingSigner && (
          <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 text-orange-800 font-medium mb-1">
              <MousePointer className="h-4 w-4" />
              โหมดเลือกตำแหน่งลายเซ็น
            </div>
            <p className="text-sm text-orange-700">
              คลิกหรือแตะบนเอกสารเพื่อกำหนดตำแหน่งสำหรับ: 
              <span className="font-medium"> {pendingSigner.position} - {pendingSigner.name}</span>
            </p>
          </div>
        )}

        {/* Interactive Mode Instructions */}
        {isInteractiveMode && !isClickMode && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
              <MapPin className="h-4 w-4" />
              โหมดแก้ไขตำแหน่งลายเซ็น
            </div>
            <p className="text-sm text-blue-700">
              ลากกล่องลายเซ็นไปยังตำแหน่งที่ต้องการบนเอกสาร คลิก "บันทึก" เมื่อเสร็จสิ้น
            </p>
          </div>
        )}

        {/* Signature Positions Summary */}
        {signaturePositions.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-800 mb-2">ผู้ลงนามที่เลือก:</h4>
            <div className="flex flex-wrap gap-2">
              {signaturePositions.map((pos) => (
                <Badge key={pos.id} variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {pos.position}: {pos.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Canvas Container */}
        <div className="relative border rounded-lg overflow-auto bg-gray-50 p-4">
          <div className="mx-auto" style={{ width: `${A4_WIDTH}px`, height: `${A4_HEIGHT}px` }}>
            <canvas
              ref={canvasRef}
              className={cn(
                "border border-gray-300 shadow-lg bg-white",
                isClickMode ? "cursor-crosshair" : "cursor-default"
              )}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        </div>

        {/* Position Coordinates Display */}
        {signaturePositions.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">พิกัดตำแหน่งลายเซ็น:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {signaturePositions.map((pos) => (
                <div key={pos.id} className="flex justify-between">
                  <span className="font-medium">{pos.position}:</span>
                  <span className="text-gray-600">X:{Math.round(pos.x)}, Y:{Math.round(pos.y)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InteractivePreview;
