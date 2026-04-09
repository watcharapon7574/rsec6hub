import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { ocrService } from '@/services/ocrService';
import { geminiOcrService } from '@/services/geminiOcrService';
import type { PageResult } from '@/services/geminiOcrService';
import type { OcrDocument, OcrProcessingState } from '@/types/ocr';

export interface QueueItem {
  id: string;
  file: File;
  docId: string | null;
  storagePath: string | null;
  fileUrl: string | null;
  status: 'registering' | 'waiting' | 'processing' | 'done' | 'error';
  error?: string;
}

export function useOcrUpload() {
  const { profile } = useEmployeeAuth();
  const [documents, setDocuments] = useState<OcrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<OcrProcessingState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const isProcessingRef = useRef(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await ocrService.getAllDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      toast.error('โหลดเอกสารไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cleanup stale 'processing' or 'pending' (registered but never processed) documents on mount
  const cleanupStale = useCallback(async () => {
    try {
      const docs = await ocrService.getAllDocuments();
      const stale = docs.filter(
        (d) => d.status === 'processing' || (d.status === 'pending' && d.storage_path)
      );
      if (stale.length > 0) {
        for (const doc of stale) {
          await ocrService.updateDocument(doc.id, { status: 'failed' } as any);
        }
        toast.info(`พบเอกสารค้าง ${stale.length} รายการ — กด "ลองใหม่" เพื่อทำต่อ`);
      }
      setDocuments(
        docs.map((d) =>
          d.status === 'processing' || (d.status === 'pending' && d.storage_path)
            ? { ...d, status: 'failed' as const }
            : d
        )
      );
      setLoading(false);
    } catch (err) {
      console.error('Cleanup failed:', err);
      fetchDocuments();
    }
  }, [fetchDocuments]);

  useEffect(() => {
    cleanupStale();
  }, [cleanupStale]);

  // Warn before closing page during active work
  useEffect(() => {
    const hasActiveWork = queue.some((item) =>
      ['registering', 'waiting', 'processing'].includes(item.status)
    );
    if (!hasActiveWork && !isProcessingRef.current) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // Shared processing logic — used by both queue and retry
  const runProcessing = useCallback(
    async (
      docId: string,
      fileBlob: File | Blob,
      storagePath: string,
      fileUrl: string,
      existingPages?: PageResult[],
      existingChunkPageNums?: Set<number>
    ) => {
      const existingPageNums = new Set(existingPages?.map((p) => p.pageNumber) || []);

      const result = await geminiOcrService.processDocument(fileBlob, {
        onProgress: (step, currentPage, totalPages) => {
          if (step === 'ocr') {
            setProcessing({
              step: 'ocr',
              currentPage,
              totalPages,
              message: totalPages && totalPages > 1
                ? `กำลัง OCR หน้า ${currentPage}/${totalPages}...`
                : 'กำลังดึงข้อความ...',
            });
          } else if (step === 'chunking') {
            setProcessing({
              step: 'chunking',
              currentPage,
              totalPages,
              message: totalPages && totalPages > 1
                ? `กำลังแบ่ง Chunk ${currentPage}/${totalPages}...`
                : 'กำลังแบ่ง Chunk...',
            });
          } else if (step === 'embedding') {
            setProcessing({ step: 'embedding', message: 'กำลังสร้าง Embedding...' });
          }
        },
        onPageComplete: async (page) => {
          if (!existingPageNums.has(page.pageNumber)) {
            await ocrService.createPageWithEmbedding({
              document_id: docId,
              page_number: page.pageNumber,
              extracted_text: page.text,
              embedding: page.embedding,
            });
          }
        },
        onChunkComplete: async (chunk) => {
          await ocrService.createChunkWithEmbedding({
            document_id: docId,
            content: chunk.content,
            content_segmented: chunk.contentSegmented,
            context_summary: chunk.contextSummary,
            page_number: chunk.pageNumber,
            chunk_index: chunk.chunkIndex,
            embedding: chunk.embedding,
          });
        },
      }, existingPages, existingChunkPageNums);

      await ocrService.updateDocumentWithEmbedding(
        docId,
        result.fullText,
        result.fullEmbedding,
        result.pages.length,
        fileUrl,
        storagePath
      );

      const updates: Record<string, unknown> = {};
      if (result.tags.length > 0) {
        updates.tags = result.tags;
      }
      if (result.suggestedFileName) {
        let ext = '';
        if (fileBlob instanceof File && fileBlob.name.includes('.')) {
          ext = '.' + fileBlob.name.split('.').pop();
        }
        updates.file_name = result.suggestedFileName + ext;
      }
      if (Object.keys(updates).length > 0) {
        await ocrService.updateDocument(docId, updates as any);
      }
    },
    []
  );

  // Retry — download from Storage, skip existing pages, continue OCR
  const retryDocument = useCallback(
    async (docId: string) => {
      if (isProcessingRef.current) {
        toast.error('กำลังประมวลผลอยู่ กรุณารอสักครู่');
        return;
      }
      isProcessingRef.current = true;

      try {
        const doc = documents.find((d) => d.id === docId);
        if (!doc?.storage_path) throw new Error('ไม่พบไฟล์ในระบบ');

        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: 'processing' as const } : d))
        );

        setProcessing({ step: 'uploading', message: 'กำลังเตรียมไฟล์สำหรับทำต่อ...' });
        const [existingDbPages, existingChunkPageNums, blob] = await Promise.all([
          ocrService.getPagesByDocument(docId),
          ocrService.getChunkPageNumbers(docId),
          ocrService.downloadFile(doc.storage_path),
        ]);

        await ocrService.updateDocument(docId, { status: 'processing' } as any);

        const existingPages: PageResult[] = existingDbPages.map((p) => ({
          pageNumber: p.page_number,
          text: p.extracted_text || '',
          embedding: [],
        }));

        if (existingPages.length > 0) {
          const chunkMsg = existingChunkPageNums.size > 0
            ? ` + ${existingChunkPageNums.size} หน้ามี chunks แล้ว`
            : '';
          toast.info(`พบ ${existingPages.length} หน้าที่ทำไว้แล้ว${chunkMsg} — ทำต่อจากจุดที่ค้าง`);
        }

        await runProcessing(docId, blob, doc.storage_path, doc.file_url || '', existingPages, existingChunkPageNums);

        toast.success('OCR สำเร็จ (ทำต่อ)');
        await fetchDocuments();
      } catch (err: any) {
        console.error('Retry failed:', err);
        try {
          await ocrService.updateDocument(docId, { status: 'failed' } as any);
        } catch (e) {
          console.warn('Failed to mark as failed:', e);
        }
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: 'failed' as const } : d))
        );
        toast.error(`ลองใหม่ล้มเหลว: ${err.message}`);
      } finally {
        setProcessing(null);
        isProcessingRef.current = false;
      }
    },
    [documents, runProcessing, fetchDocuments]
  );

  // Process registered queue items (already have DB record + storage file)
  const processQueue = useCallback(
    async (items: QueueItem[]) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      for (const item of items) {
        if (!item.docId || !item.storagePath || !item.fileUrl) continue;

        setQueue((prev) =>
          prev.map((q) => q.id === item.id ? { ...q, status: 'processing' as const } : q)
        );

        try {
          await ocrService.updateDocument(item.docId, { status: 'processing' } as any);

          setProcessing({ step: 'uploading', message: 'กำลังเตรียมไฟล์...' });
          const blob = await ocrService.downloadFile(item.storagePath);

          await runProcessing(item.docId, blob, item.storagePath, item.fileUrl);

          setQueue((prev) =>
            prev.map((q) => q.id === item.id ? { ...q, status: 'done' as const } : q)
          );
          toast.success(`OCR สำเร็จ: ${item.file.name}`);
        } catch (err: any) {
          console.error('OCR processing failed:', err);
          if (item.docId) {
            try {
              await ocrService.updateDocument(item.docId, { status: 'failed' } as any);
            } catch (e) {
              console.warn('Failed to mark as failed:', e);
            }
          }
          setQueue((prev) =>
            prev.map((q) => q.id === item.id ? { ...q, status: 'error' as const, error: err.message } : q)
          );
          toast.error(`OCR ล้มเหลว: ${item.file.name}`);
        }
      }

      setProcessing(null);
      isProcessingRef.current = false;
      await fetchDocuments();

      // Clear queue after 5 seconds
      setTimeout(() => setQueue([]), 5000);
    },
    [runProcessing, fetchDocuments]
  );

  // Register files to DB + upload to Storage, then mark as 'waiting' for processing
  const addToQueue = useCallback(
    async (files: File[]) => {
      if (!profile?.user_id) {
        toast.error('กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      const newItems: QueueItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        docId: null,
        storagePath: null,
        fileUrl: null,
        status: 'registering' as const,
      }));

      setQueue((prev) => [...prev, ...newItems]);

      // Register all files in parallel (create DB record + upload to Storage)
      await Promise.all(
        newItems.map(async (item) => {
          try {
            const fileType = geminiOcrService.detectFileType(item.file);
            const doc = await ocrService.createDocument({
              user_id: profile.user_id,
              file_name: item.file.name,
              file_type: fileType,
              file_size: item.file.size,
            });

            const upload = await ocrService.uploadFile(item.file, profile.user_id, doc.id);
            await ocrService.updateDocument(doc.id, {
              file_url: upload.url,
              storage_path: upload.path,
            } as any);

            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, docId: doc.id, storagePath: upload.path, fileUrl: upload.url, status: 'waiting' as const }
                  : q
              )
            );
          } catch (err: any) {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, status: 'error' as const, error: err.message } : q
              )
            );
            toast.error(`ลงทะเบียนไม่สำเร็จ: ${item.file.name}`);
          }
        })
      );

      // Refresh document list to show newly registered docs
      await fetchDocuments();
    },
    [profile, fetchDocuments]
  );

  // Auto-process 'waiting' items when queue changes and not currently processing
  useEffect(() => {
    if (isProcessingRef.current) return;
    const waitingItems = queue.filter((item) => item.status === 'waiting' && item.docId);
    if (waitingItems.length > 0) {
      processQueue(waitingItems);
    }
  }, [queue, processQueue]);

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!profile?.user_id) {
        toast.error('ไม่พบข้อมูลผู้ใช้');
        return;
      }
      try {
        const displayName = profile.prefix
          ? `${profile.prefix}${profile.first_name} ${profile.last_name}`
          : `${profile.first_name} ${profile.last_name}`;
        await ocrService.deleteDocument(id, profile.user_id, displayName);
        toast.success('ลบเอกสารสำเร็จ');
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } catch (err: any) {
        console.error('Delete failed:', err);
        toast.error(`ลบไม่สำเร็จ: ${err.message}`);
      }
    },
    [profile]
  );

  const updateTags = useCallback(
    async (id: string, tags: string[]) => {
      try {
        await ocrService.updateDocument(id, { tags } as any);
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, tags } : d))
        );
        toast.success('บันทึก tags สำเร็จ');
      } catch (err: any) {
        console.error('Update tags failed:', err);
        toast.error(`บันทึก tags ไม่สำเร็จ: ${err.message}`);
      }
    },
    []
  );

  const togglePublic = useCallback(
    async (id: string, isPublic: boolean) => {
      try {
        await ocrService.updateDocument(id, { is_public: isPublic } as any);
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, is_public: isPublic } : d))
        );
        toast.success(isPublic ? 'เปิดเผยแพร่สาธารณะแล้ว' : 'ปิดเผยแพร่สาธารณะแล้ว');
      } catch (err: any) {
        console.error('Toggle public failed:', err);
        toast.error(`เปลี่ยนสถานะไม่สำเร็จ: ${err.message}`);
      }
    },
    []
  );

  return {
    documents,
    loading,
    processing,
    queue,
    addToQueue,
    deleteDocument,
    updateTags,
    togglePublic,
    retryDocument,
    refetch: fetchDocuments,
  };
}
