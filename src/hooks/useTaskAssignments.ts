import { useState, useEffect, useCallback } from 'react';
import { taskAssignmentService, DocumentType, TaskStatus } from '@/services/taskAssignmentService';
import type { DocumentReadyForAssignment } from '@/services/taskAssignmentService';
import { toast } from '@/hooks/use-toast';

/**
 * Hook สำหรับจัดการเอกสารที่พร้อมมอบหมาย (ฝั่งธุรการ)
 */
export const useTaskAssignments = () => {
  const [documents, setDocuments] = useState<DocumentReadyForAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ดึงรายการเอกสารที่พร้อมมอบหมาย
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await taskAssignmentService.getDocumentsReadyForAssignment();
      setDocuments(data);
    } catch (err: any) {
      const errorMessage = err.message || 'ไม่สามารถโหลดรายการเอกสารได้';
      setError(errorMessage);
      console.error('Error fetching documents ready for assignment:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // สร้างงานมอบหมาย
  const createAssignment = useCallback(
    async (
      documentId: string,
      documentType: DocumentType,
      assignedToUserIds: string[],
      note?: string
    ) => {
      setLoading(true);
      setError(null);

      try {
        await taskAssignmentService.createMultipleTaskAssignments(
          documentId,
          documentType,
          assignedToUserIds,
          note
        );

        toast({
          title: 'มอบหมายงานสำเร็จ',
          description: `มอบหมายงานให้ ${assignedToUserIds.length} คนเรียบร้อยแล้ว`,
        });

        // Refresh document list
        await fetchDocuments();

        return true;
      } catch (err: any) {
        const errorMessage = err.message || 'ไม่สามารถมอบหมายงานได้';
        setError(errorMessage);

        toast({
          title: 'เกิดข้อผิดพลาด',
          description: errorMessage,
          variant: 'destructive',
        });

        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchDocuments]
  );

  // โหลดข้อมูลครั้งแรก
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    createAssignment,
  };
};
