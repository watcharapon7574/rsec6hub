import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle, Line, Textbox, FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import {
  X, Pen, Highlighter, Type, CircleIcon, ArrowRight,
  Eraser, Undo2, ChevronLeft, ChevronRight, Save, Loader2, Hand
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPdfPageToCanvas, loadPdfFromUrl, exportAnnotatedPdf } from '@/utils/pdfAnnotationUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

type Tool = 'pen' | 'highlighter' | 'text' | 'circle' | 'arrow' | 'eraser' | 'pan';

const COLORS = [
  { value: '#FF0000', label: 'แดง' },
  { value: '#0066FF', label: 'น้ำเงิน' },
  { value: '#00AA00', label: 'เขียว' },
  { value: '#000000', label: 'ดำ' },
  { value: '#FF8800', label: 'ส้ม' },
];

const PEN_WIDTHS = [
  { value: 2, label: 'บาง' },
  { value: 4, label: 'กลาง' },
  { value: 8, label: 'หนา' },
];

interface PDFAnnotationEditorProps {
  pdfUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (annotatedPdfBlob: Blob) => void;
  isSaving?: boolean;
}

const PDFAnnotationEditor: React.FC<PDFAnnotationEditorProps> = ({
  pdfUrl,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}) => {
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // Tool state (both state for UI + ref for canvas handlers)
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState('#FF0000');
  const [penWidth, setPenWidth] = useState(4);
  const activeToolRef = useRef<Tool>('pen');
  const penColorRef = useRef('#FF0000');
  const penWidthRef = useRef(4);

  // Keep refs in sync with state
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { penWidthRef.current = penWidth; }, [penWidth]);

  // Canvas
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Annotation storage: page number -> Fabric JSON string
  const annotationsRef = useRef<Map<number, string>>(new Map());

  // Undo history
  const historyRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Shape drawing state
  const isDrawingShapeRef = useRef(false);
  const shapeStartRef = useRef({ x: 0, y: 0 });
  const currentShapeRef = useRef<FabricObject | null>(null);

  // Multi-touch scroll state (for iPad two-finger scroll)
  const isTwoFingerRef = useRef(false);

  // Loading
  const [loading, setLoading] = useState(true);

  // Load PDF
  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const bytes = await loadPdfFromUrl(pdfUrl);
        if (cancelled) return;
        setPdfBytes(bytes);

        const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        annotationsRef.current = new Map();
      } catch (err) {
        console.error('Failed to load PDF:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isOpen, pdfUrl]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !bgCanvasRef.current) return;
    const size = await renderPdfPageToCanvas(pdfDoc, currentPage, bgCanvasRef.current, 1.5);
    setPageSize(size);
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    if (pdfDoc) renderPage();
  }, [pdfDoc, currentPage, renderPage]);

  // ===== Core: apply tool to Fabric canvas =====
  const applyCurrentTool = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const tool = activeToolRef.current;
    const color = penColorRef.current;
    const width = penWidthRef.current;

    // Clean up all custom event handlers
    fc.off('mouse:down');
    fc.off('mouse:move');
    fc.off('mouse:up');

    // Reset shape state
    isDrawingShapeRef.current = false;
    currentShapeRef.current = null;

    switch (tool) {
      case 'pen': {
        fc.isDrawingMode = true;
        fc.selection = false;
        const brush = new PencilBrush(fc);
        brush.color = color;
        brush.width = width;
        fc.freeDrawingBrush = brush;
        break;
      }
      case 'highlighter': {
        fc.isDrawingMode = true;
        fc.selection = false;
        const hlBrush = new PencilBrush(fc);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        hlBrush.color = `rgba(${r},${g},${b},0.3)`;
        hlBrush.width = 20;
        fc.freeDrawingBrush = hlBrush;
        break;
      }
      case 'text': {
        fc.isDrawingMode = false;
        fc.selection = true;
        fc.on('mouse:down', (opt: any) => {
          if (opt.target) return; // clicked existing object, skip
          const pointer = fc.getScenePoint(opt.e);
          const text = new Textbox('ข้อความ', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 20,
            fill: color,
            width: 200,
            editable: true,
          });
          fc.add(text);
          fc.setActiveObject(text);
          text.enterEditing();
          fc.renderAll();
        });
        break;
      }
      case 'circle': {
        fc.isDrawingMode = false;
        fc.selection = false;

        fc.on('mouse:down', (opt: any) => {
          const pointer = fc.getScenePoint(opt.e);
          isDrawingShapeRef.current = true;
          shapeStartRef.current = { x: pointer.x, y: pointer.y };

          const circle = new Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 1,
            fill: 'transparent',
            stroke: color,
            strokeWidth: width,
            selectable: false,
            originX: 'center',
            originY: 'center',
          });
          fc.add(circle);
          currentShapeRef.current = circle;
        });

        fc.on('mouse:move', (opt: any) => {
          if (!isDrawingShapeRef.current || !currentShapeRef.current) return;
          const pointer = fc.getScenePoint(opt.e);
          const start = shapeStartRef.current;
          const dx = pointer.x - start.x;
          const dy = pointer.y - start.y;
          const radius = Math.sqrt(dx * dx + dy * dy) / 2;
          const cx = (start.x + pointer.x) / 2;
          const cy = (start.y + pointer.y) / 2;

          (currentShapeRef.current as Circle).set({
            left: cx,
            top: cy,
            radius: Math.max(radius, 1),
            scaleX: 1,
            scaleY: 1,
          });
          fc.renderAll();
        });

        fc.on('mouse:up', () => {
          if (currentShapeRef.current) {
            currentShapeRef.current.set({ selectable: true });
          }
          isDrawingShapeRef.current = false;
          currentShapeRef.current = null;
        });
        break;
      }
      case 'arrow': {
        fc.isDrawingMode = false;
        fc.selection = false;

        fc.on('mouse:down', (opt: any) => {
          const pointer = fc.getScenePoint(opt.e);
          isDrawingShapeRef.current = true;
          shapeStartRef.current = { x: pointer.x, y: pointer.y };

          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color,
            strokeWidth: width,
            selectable: false,
          });
          fc.add(line);
          currentShapeRef.current = line;
        });

        fc.on('mouse:move', (opt: any) => {
          if (!isDrawingShapeRef.current || !currentShapeRef.current) return;
          const pointer = fc.getScenePoint(opt.e);
          (currentShapeRef.current as Line).set({ x2: pointer.x, y2: pointer.y });
          fc.renderAll();
        });

        fc.on('mouse:up', (opt: any) => {
          if (!currentShapeRef.current) return;
          const pointer = fc.getScenePoint(opt.e);
          const start = shapeStartRef.current;
          const angle = Math.atan2(pointer.y - start.y, pointer.x - start.x);
          const headLen = 15;

          const arrow1 = new Line([
            pointer.x, pointer.y,
            pointer.x - headLen * Math.cos(angle - Math.PI / 6),
            pointer.y - headLen * Math.sin(angle - Math.PI / 6),
          ], { stroke: color, strokeWidth: width, selectable: true });

          const arrow2 = new Line([
            pointer.x, pointer.y,
            pointer.x - headLen * Math.cos(angle + Math.PI / 6),
            pointer.y - headLen * Math.sin(angle + Math.PI / 6),
          ], { stroke: color, strokeWidth: width, selectable: true });

          fc.add(arrow1);
          fc.add(arrow2);
          currentShapeRef.current.set({ selectable: true });

          isDrawingShapeRef.current = false;
          currentShapeRef.current = null;
          fc.renderAll();
        });
        break;
      }
      case 'eraser': {
        fc.isDrawingMode = false;
        fc.selection = true;
        fc.on('mouse:down', (opt: any) => {
          const target = fc.findTarget(opt.e);
          if (target) {
            fc.remove(target);
            fc.renderAll();
          }
        });
        break;
      }
      case 'pan': {
        fc.isDrawingMode = false;
        fc.selection = false;
        break;
      }
    }

    // Set touch-action based on tool: pan allows scrolling, drawing tools block it
    const canvasEl = fc.getSelectionElement?.() || drawCanvasRef.current;
    if (canvasEl) {
      canvasEl.style.touchAction = tool === 'pan' ? 'auto' : 'none';
    }
    // Also set on the upper-canvas (Fabric creates its own canvas elements)
    const upperCanvas = drawCanvasRef.current?.parentElement?.querySelector('.upper-canvas') as HTMLCanvasElement | null;
    if (upperCanvas) {
      upperCanvas.style.touchAction = tool === 'pan' ? 'auto' : 'none';
    }
  }, []);

  // Initialize Fabric canvas when page size changes
  useEffect(() => {
    if (pageSize.width === 0 || pageSize.height === 0 || !drawCanvasRef.current) return;

    // Dispose old canvas
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const fc = new FabricCanvas(drawCanvasRef.current, {
      width: pageSize.width,
      height: pageSize.height,
      backgroundColor: 'transparent',
      isDrawingMode: false,
    });

    // Track history for undo
    fc.on('object:added', () => {
      historyRef.current.push(JSON.stringify(fc.toJSON()));
      setCanUndo(historyRef.current.length > 1);
    });

    fabricRef.current = fc;

    // Restore annotations for this page if any
    const saved = annotationsRef.current.get(currentPage);
    if (saved) {
      fc.loadFromJSON(saved).then(() => {
        fc.renderAll();
        applyCurrentTool();
      });
    } else {
      applyCurrentTool();
    }

    return () => {
      // Save current page annotations before dispose
      if (fabricRef.current) {
        const json = JSON.stringify(fabricRef.current.toJSON());
        annotationsRef.current.set(currentPage, json);
      }
      fc.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // Re-apply tool when tool/color/width changes
  useEffect(() => {
    applyCurrentTool();
  }, [activeTool, penColor, penWidth, applyCurrentTool]);

  // Page navigation
  const saveCurrentAnnotations = () => {
    if (fabricRef.current) {
      const json = JSON.stringify(fabricRef.current.toJSON());
      annotationsRef.current.set(currentPage, json);
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    saveCurrentAnnotations();
    historyRef.current = [];
    setCanUndo(false);
    setCurrentPage(page);
  };

  // Undo
  const handleUndo = () => {
    if (!fabricRef.current || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev) {
      fabricRef.current.loadFromJSON(prev).then(() => {
        fabricRef.current?.renderAll();
        setCanUndo(historyRef.current.length > 1);
        applyCurrentTool();
      });
    } else {
      fabricRef.current.clear();
      setCanUndo(false);
    }
  };

  // Save / export
  const handleSave = async () => {
    if (!pdfBytes || !fabricRef.current) return;

    saveCurrentAnnotations();

    const pageImages = new Map<number, string>();

    for (const [pageNum, jsonStr] of annotationsRef.current) {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.objects || parsed.objects.length === 0) continue;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = pageSize.width;
      tempCanvas.height = pageSize.height;

      const tempFc = new FabricCanvas(tempCanvas, {
        width: pageSize.width,
        height: pageSize.height,
        backgroundColor: 'transparent',
      });

      await tempFc.loadFromJSON(jsonStr);
      tempFc.renderAll();

      const dataUrl = tempFc.toDataURL({ format: 'png', multiplier: 1 });
      pageImages.set(pageNum, dataUrl);
      tempFc.dispose();
    }

    if (pageImages.size === 0) {
      onSave(new Blob([pdfBytes], { type: 'application/pdf' }));
      return;
    }

    const blob = await exportAnnotatedPdf(pdfBytes, pageImages);
    onSave(blob);
  };

  // Two-finger scroll: temporarily allow browser scroll when 2+ fingers detected
  const handleCanvasTouchStart = useCallback((e: React.TouchEvent) => {
    if (activeToolRef.current === 'pan') return; // pan mode already allows scroll
    if (e.touches.length >= 2) {
      isTwoFingerRef.current = true;
      const fc = fabricRef.current;
      if (fc) {
        fc.isDrawingMode = false;
        fc.selection = false;
      }
      // Allow browser scroll
      const upperCanvas = drawCanvasRef.current?.parentElement?.querySelector('.upper-canvas') as HTMLCanvasElement | null;
      if (upperCanvas) upperCanvas.style.touchAction = 'auto';
      if (drawCanvasRef.current) drawCanvasRef.current.style.touchAction = 'auto';
    }
  }, []);

  const handleCanvasTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isTwoFingerRef.current) return;
    if (e.touches.length === 0) {
      isTwoFingerRef.current = false;
      // Restore tool after multi-touch ends
      applyCurrentTool();
    }
  }, [applyCurrentTool]);

  if (!isOpen) return null;

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pan', icon: <Hand className="h-4 w-4" />, label: 'เลื่อน' },
    { id: 'pen', icon: <Pen className="h-4 w-4" />, label: 'ปากกา' },
    { id: 'highlighter', icon: <Highlighter className="h-4 w-4" />, label: 'ไฮไลท์' },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: 'ข้อความ' },
    { id: 'circle', icon: <CircleIcon className="h-4 w-4" />, label: 'วงกลม' },
    { id: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'ลูกศร' },
    { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'ยางลบ' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col">
      {/* Top Toolbar */}
      <div className="bg-white border-b shadow-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        {/* Close */}
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
          <X className="h-4 w-4 mr-1" /> ปิด
        </Button>

        <div className="w-px h-6 bg-gray-300" />

        {/* Tools */}
        {tools.map((t) => (
          <Button
            key={t.id}
            variant={activeTool === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(t.id)}
            title={t.label}
          >
            {t.icon}
            <span className="hidden sm:inline ml-1 text-xs">{t.label}</span>
          </Button>
        ))}

        <div className="w-px h-6 bg-gray-300" />

        {/* Colors */}
        {COLORS.map((c) => (
          <button
            key={c.value}
            className={cn(
              'w-6 h-6 rounded-full border-2 transition-transform',
              penColor === c.value ? 'border-gray-800 scale-125' : 'border-gray-300'
            )}
            style={{ backgroundColor: c.value }}
            onClick={() => setPenColor(c.value)}
            title={c.label}
          />
        ))}

        <div className="w-px h-6 bg-gray-300" />

        {/* Pen Width */}
        {PEN_WIDTHS.map((w) => (
          <Button
            key={w.value}
            variant={penWidth === w.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPenWidth(w.value)}
            className="px-2"
            title={w.label}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: w.value * 2, height: w.value * 2 }}
            />
          </Button>
        ))}

        <div className="w-px h-6 bg-gray-300" />

        {/* Undo */}
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Save */}
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          {isSaving ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> กำลังบันทึก...</>
          ) : (
            <><Save className="h-4 w-4 mr-1" /> บันทึก</>
          )}
        </Button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-4" ref={containerRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm text-gray-500">กำลังโหลด PDF...</p>
          </div>
        ) : (
          <div
            className="relative shadow-lg"
            style={{ width: pageSize.width, height: pageSize.height }}
            onTouchStart={handleCanvasTouchStart}
            onTouchEnd={handleCanvasTouchEnd}
          >
            <canvas
              ref={bgCanvasRef}
              className="absolute inset-0"
              style={{ width: pageSize.width, height: pageSize.height }}
            />
            <canvas
              ref={drawCanvasRef}
              className="absolute inset-0"
              style={{ touchAction: activeTool === 'pan' ? 'auto' : 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFAnnotationEditor;
