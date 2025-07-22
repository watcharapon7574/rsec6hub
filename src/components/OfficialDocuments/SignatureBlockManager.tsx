import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Move, Eye, EyeOff } from 'lucide-react';

interface SignatureBlock {
  id: string;
  role: 'assistant' | 'deputy' | 'director';
  label: string;
  signer: {
    name: string;
    position: string;
    signature_url?: string;
    comment?: string;
  };
  position: {
    x: number;
    y: number;
    page: number;
  };
  visible: boolean;
}

interface SignatureBlockManagerProps {
  blocks: SignatureBlock[];
  onPositionUpdate: (blockId: string, position: { x: number; y: number; page: number }) => void;
  onToggleVisibility: (blockId: string) => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  onBlockSelect?: (blockId: string | null) => void;
  selectedBlock?: string | null;
}

const SignatureBlockManager: React.FC<SignatureBlockManagerProps> = ({
  blocks,
  onPositionUpdate,
  onToggleVisibility,
  editMode,
  onEditModeToggle,
  onBlockSelect,
  selectedBlock: externalSelectedBlock
}) => {
  const [localSelectedBlock, setLocalSelectedBlock] = useState<string | null>(null);
  const selectedBlock = externalSelectedBlock ?? localSelectedBlock;

  const handleBlockClick = (blockId: string) => {
    const newSelection = selectedBlock === blockId ? null : blockId;
    if (onBlockSelect) {
      onBlockSelect(newSelection);
    } else {
      setLocalSelectedBlock(newSelection);
    }
  };

  const roleLabels = {
    assistant: 'ผู้ช่วย ผอ. (a)',
    deputy: 'รอง ผอ. (b)',
    director: 'ผอ. (c)'
  };

  const roleColors = {
    assistant: 'bg-green-100 text-green-800 border-green-300',
    deputy: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    director: 'bg-red-100 text-red-800 border-red-300'
  };

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <MapPin className="h-5 w-5" />
            จัดการตำแหน่งลายเซ็น
          </CardTitle>
          <Button
            onClick={onEditModeToggle}
            variant={editMode ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <Move className="h-4 w-4" />
            {editMode ? 'ปิดโหมดแก้ไข' : 'แก้ไขตำแหน่ง'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {editMode && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Move className="h-4 w-4 inline mr-1" />
              1. เลือกบล็อกลายเซ็นด้านล่าง 2. คลิกบนเอกสารเพื่อกำหนดตำแหน่งใหม่
            </p>
            {selectedBlock && (
              <p className="text-sm text-orange-700 mt-1 font-medium">
                📍 เลือกบล็อก: {roleLabels[blocks.find(b => b.id === selectedBlock)?.role || 'assistant']} - คลิกบนเอกสารเพื่อย้าย
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>ยังไม่มีผู้ลงนาม</p>
              <p className="text-sm">เลือกผู้ลงนามเพื่อสร้างบล็อกลายเซ็น</p>
            </div>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                className={`p-3 border rounded-lg transition-all cursor-pointer ${
                  selectedBlock === block.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!block.visible ? 'opacity-50' : ''}`}
                onClick={() => handleBlockClick(block.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${roleColors[block.role]} font-medium`}>
                        {roleLabels[block.role]}
                      </Badge>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisibility(block.id);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        {block.visible ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">{block.signer.name}</p>
                      <p className="text-sm text-gray-600">{block.signer.position}</p>
                      {block.signer.comment && (
                        <p className="text-sm text-blue-600 italic">"{block.signer.comment}"</p>
                      )}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      ตำแหน่ง: หน้า {block.position.page + 1}, 
                      X: {block.position.x}, Y: {block.position.y}
                    </div>
                  </div>
                  
                  {block.signer.signature_url && (
                    <div className="ml-3">
                      <img
                        src={block.signer.signature_url}
                        alt="ลายเซ็น"
                        className="h-8 w-16 object-contain border border-gray-200 rounded bg-white"
                      />
                    </div>
                  )}
                </div>
                
                {selectedBlock === block.id && editMode && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-sm text-blue-700">
                      คลิกบนเอกสารเพื่อย้ายบล็อกนี้ไปตำแหน่งใหม่
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {blocks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">สถิติ:</p>
              <div className="flex gap-4">
                <span>บล็อกทั้งหมด: {blocks.length}</span>
                <span>แสดง: {blocks.filter(b => b.visible).length}</span>
                <span>ซ่อน: {blocks.filter(b => !b.visible).length}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SignatureBlockManager;