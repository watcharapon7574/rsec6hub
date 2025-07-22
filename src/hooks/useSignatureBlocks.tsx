import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SignatureBlock, SignerRole, Signer, SelectedSigners } from '@/types/pdfSignature';

const DEFAULT_POSITIONS = {
  assistant: { x: 400, y: 250, page: 0 },
  deputy: { x: 100, y: 270, page: 0 },
  director: { x: 250, y: 530, page: 0 }
};

export const useSignatureBlocks = () => {
  const { toast } = useToast();
  const [selectedSigners, setSelectedSigners] = useState<SelectedSigners>({});
  const [signatureBlocks, setSignatureBlocks] = useState<SignatureBlock[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedBlockForPosition, setSelectedBlockForPosition] = useState<string | null>(null);

  const handleSignerSelect = (role: SignerRole, signer: Signer | null) => {
    if (signer) {
      setSelectedSigners(prev => ({
        ...prev,
        [role]: { ...signer, comment: '' }
      }));

      // Create signature block
      const blockId = `block_${role}`;
      const newBlock: SignatureBlock = {
        id: blockId,
        role,
        label: role === 'assistant' ? 'a' : role === 'deputy' ? 'b' : 'c',
        signer: { ...signer, comment: '' },
        position: DEFAULT_POSITIONS[role],
        visible: true
      };

      setSignatureBlocks(prev => [
        ...prev.filter(b => b.role !== role),
        newBlock
      ]);
    } else {
      setSelectedSigners(prev => {
        const { [role]: _, ...rest } = prev;
        return rest;
      });
      setSignatureBlocks(prev => prev.filter(b => b.role !== role));
    }
  };

  const handleCommentChange = (role: SignerRole, comment: string) => {
    setSelectedSigners(prev => ({
      ...prev,
      [role]: prev[role] ? { ...prev[role], comment } : undefined
    }));

    setSignatureBlocks(prev => prev.map(block => 
      block.role === role 
        ? { ...block, signer: { ...block.signer, comment } }
        : block
    ));
  };

  const handlePositionClick = (page: number, x: number, y: number) => {
    if (!editMode && !selectedBlockForPosition) return;

    if (selectedBlockForPosition) {
      setSignatureBlocks(prev => prev.map(block =>
        block.id === selectedBlockForPosition
          ? { ...block, position: { x, y, page } }
          : block
      ));
      setSelectedBlockForPosition(null);
      toast({
        title: "อัปเดตตำแหน่งเรียบร้อย",
        description: "ตำแหน่งลายเซ็นถูกเปลี่ยนแปลงแล้ว",
      });
    }
  };

  const handleBlockPositionUpdate = (blockId: string, position: { x: number; y: number; page: number }) => {
    setSignatureBlocks(prev => prev.map(block =>
      block.id === blockId ? { ...block, position } : block
    ));
  };

  const handleBlockVisibilityToggle = (blockId: string) => {
    setSignatureBlocks(prev => prev.map(block =>
      block.id === blockId ? { ...block, visible: !block.visible } : block
    ));
  };

  const resetSignatureBlocks = () => {
    setSelectedSigners({});
    setSignatureBlocks([]);
    setEditMode(false);
    setSelectedBlockForPosition(null);
  };

  return {
    selectedSigners,
    signatureBlocks,
    editMode,
    selectedBlockForPosition,
    setEditMode,
    setSelectedBlockForPosition,
    handleSignerSelect,
    handleCommentChange,
    handlePositionClick,
    handleBlockPositionUpdate,
    handleBlockVisibilityToggle,
    resetSignatureBlocks
  };
};