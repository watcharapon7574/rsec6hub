import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin, ToolbarSlot } from '@react-pdf-viewer/default-layout';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';

// Custom CSS to hide unwanted toolbar items
const pdfViewerStyles = `
  .rpv-default-layout__toolbar {
    padding: 4px 8px !important;
  }
  
  .rpv-toolbar__item:not([data-testid*="page"]):not([data-testid*="current-page"]):not([data-testid*="previous"]):not([data-testid*="next"]):not([data-testid*="first"]):not([data-testid*="last"]) {
    display: none !important;
  }
  
  .rpv-toolbar__item[data-testid*="zoom"],
  .rpv-toolbar__item[data-testid*="download"],
  .rpv-toolbar__item[data-testid*="print"],
  .rpv-toolbar__item[data-testid*="rotate"],
  .rpv-toolbar__item[data-testid*="fullscreen"],
  .rpv-toolbar__item[data-testid*="properties"],
  .rpv-toolbar__item[data-testid*="theme"],
  .rpv-toolbar__item[data-testid*="selection"],
  .rpv-toolbar__item[data-testid*="scroll"],
  .rpv-toolbar__item[data-testid*="open"] {
    display: none !important;
  }

  .rpv-core__viewer {
    /* Keep only navigation controls */
  }

  @keyframes pulse {
    0%, 100% { 
      transform: scale(1) translate(-50%, -100%); 
    }
    50% { 
      transform: scale(1.05) translate(-50%, -100%); 
    }
  }
  
  .pulse-pin {
    animation: pulse 2s ease-in-out infinite;
  }
`;
import {
  Download,
  MapPin,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  RotateCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignatureBlock {
  id: string;
  role: 'assistant' | 'deputy' | 'director';
  position: { x: number; y: number; page: number };
  visible: boolean;
}

interface SignaturePosition {
  signer: {
    order: number;
    name: string;
    position: string;
    role: string;
    academic_rank?: string;
    org_structure_role?: string;
    prefix?: string;
    user_id?: string;
    signature_url?: string;
  };
  x: number;
  y: number;
  page: number;
  comment?: string;
}

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  onPositionClick?: (x: number, y: number, page: number) => void;
  onPositionRemove?: (index: number) => void; // เพิ่มฟังก์ชันลบตำแหน่ง
  signaturePositions?: SignaturePosition[];
  signers?: any[]; // เพิ่ม signers prop เพื่อแสดงข้อมูลที่ถูกต้อง
  memo?: any; // เพิ่ม memo prop เพื่อใช้ updated_at
  signatureBlocks?: SignatureBlock[];
  showSignatureMode?: boolean;
  editMode?: boolean;
  showZoomControls?: boolean; // เพิ่มเพื่อควบคุมการแสดงปุ่ม zoom
  showFullscreenButton?: boolean; // แสดงปุ่มเต็มจอ+หมุน
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  fileName,
  onPositionClick,
  onPositionRemove,
  signaturePositions = [],
  signers = [],
  memo,
  signatureBlocks = [],
  showSignatureMode = false,
  editMode = false,
  showZoomControls = false, // เพิ่มพารามิเตอร์ใหม่
  showFullscreenButton = false,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scale, setScale] = useState(1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Fullscreen + Rotation state (CSS-based, works on iOS Safari)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 or 90
  const fullscreenWrapperRef = useRef<HTMLDivElement>(null);

  // ===== Fullscreen + Rotation logic (CSS-based overlay) =====
  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    // ป้องกันการ scroll ของ body เมื่ออยู่ใน fullscreen
    document.body.style.overflow = 'hidden';
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setRotation(0);
    document.body.style.overflow = '';
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) enterFullscreen();
    else exitFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const toggleRotation = useCallback(() => {
    setRotation(prev => prev === 0 ? 90 : 0);
  }, []);

  // กด Escape เพื่อออกจาก fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen, exitFullscreen]);

  // Cleanup body overflow on unmount
  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  const isRotated = rotation === 90;

  // ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย
  const formatThaiDate = (dateString: string) => {
    const date = new Date(dateString);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const thaiNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // แปลงเป็น พ.ศ.
    
    // แปลงตัวเลขเป็นตัวเลขไทย
    const thaiDay = day.toString().split('').map(digit => thaiNumerals[parseInt(digit)]).join('');
    const thaiYear = year.toString().split('').map(digit => thaiNumerals[parseInt(digit)]).join('');
    
    return `${thaiDay} ${month} ${thaiYear}`;
  };
  
  // สร้าง toolbar ที่มีแค่ปุ่มเปลี่ยนหน้า
  const transform: (slot: ToolbarSlot) => ToolbarSlot = (slot: ToolbarSlot) => ({
    ...slot,
    Download: () => <></>,
    DownloadMenuItem: () => <></>,
    EnterFullScreen: () => <></>,
    EnterFullScreenMenuItem: () => <></>,
    Open: () => <></>,
    OpenMenuItem: () => <></>,
    Print: () => <></>,
    PrintMenuItem: () => <></>,
    Rotate: () => <></>,
    RotateBackwardMenuItem: () => <></>,
    RotateForwardMenuItem: () => <></>,
    SwitchScrollMode: () => <></>,
    SwitchScrollModeMenuItem: () => <></>,
    SwitchSelectionMode: () => <></>,
    SwitchSelectionModeMenuItem: () => <></>,
    SwitchTheme: () => <></>,
    SwitchThemeMenuItem: () => <></>,
    Zoom: () => <></>,
    ZoomIn: () => <></>,
    ZoomOut: () => <></>,
    ZoomInMenuItem: () => <></>,
    ZoomOutMenuItem: () => <></>,
    ShowProperties: () => <></>,
    ShowPropertiesMenuItem: () => <></>,
  });

  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
  });

  // ตรวจสอบชนิดไฟล์
  const isValidPDF = useCallback((url: string): boolean => {
    return url && (url.toLowerCase().includes('.pdf') || url.includes('application/pdf'));
  }, []);

  // ตรวจสอบว่าเป็น Supabase storage URL หรือไม่
  const isSupabaseStorageUrl = useCallback((url: string): boolean => {
    return url && url.includes('supabase') && url.includes('/storage/');
  }, []);

  // ดึงไฟล์จาก Supabase storage และแปลงเป็น blob URL
  const fetchSupabaseFile = useCallback(async (url: string): Promise<string> => {
    try {
      // ลองใช้ public URL ก่อน
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    } catch (error) {
      console.error('❌ Error fetching Supabase file:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (fileUrl && isValidPDF(fileUrl)) {
      setError(null);
      setLoading(true);
      
      // ตั้ง timeout สำหรับ loading state
      const loadingTimeout = setTimeout(() => {
        setError('การโหลด PDF ใช้เวลานานเกินไป กรุณาลองดาวน์โหลดไฟล์');
        setLoading(false);
      }, 15000); // 15 วินาที

      // ถ้าเป็น Supabase storage URL ให้แปลงเป็น blob URL ก่อน
      if (isSupabaseStorageUrl(fileUrl)) {
        fetchSupabaseFile(fileUrl)
          .then((blobUrl) => {
            setBlobUrl(blobUrl);
          })
          .catch((error) => {
            console.error('❌ Failed to fetch Supabase file:', error);
            setError('ไม่สามารถโหลดไฟล์จาก storage ได้ กรุณาลองใหม่อีกครั้ง');
            setLoading(false);
          });
      } else {
        setBlobUrl(fileUrl);
      }

      return () => {
        clearTimeout(loadingTimeout);
        // ล้าง blob URL เมื่อ component unmount
        if (blobUrl && blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else if (fileUrl) {
      setError('ไฟล์ที่เลือกไม่ใช่ไฟล์ PDF');
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [fileUrl, isValidPDF, isSupabaseStorageUrl, fetchSupabaseFile]);

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Handle page change
  const handlePageChange = (e: any) => {
    setCurrentPageIndex(e.currentPage);
    // Force refresh when page changes to update pin positions
    setRefreshKey(prev => prev + 1);
  };

  // Handle document load
  const handleDocumentLoad = (e: any) => {
    setTotalPages(e.doc.numPages);
    setLoading(false);
    setError(null);
  };

  // Handle document load error
  const handleDocumentLoadError = (e: any) => {
    setError('ไม่สามารถโหลด PDF ได้ กรุณาลองใหม่อีกครั้ง');
    setLoading(false);
  };

  // Handle signature position click
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    if (!onPositionClick || !showSignatureMode) return;

    const container = viewerRef.current;
    if (!container) return;

    // Find the actual PDF page element that was clicked
    const clickedElement = e.target as HTMLElement;
    const pdfPage = clickedElement.closest('.rpv-core__page-layer');

    if (!pdfPage) {
      console.warn('Could not find PDF page element from click target.');
      return;
    }

    const rect = pdfPage.getBoundingClientRect();
    
    // Calculate position relative to the PDF page element
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert DOM coordinates to PDF coordinates
    // A4 standard: 595 x 842 points
    const standardPageWidth = 595;
    const standardPageHeight = 842;
    
    // Calculate scale factors based on actual page size vs A4 standard
    const scaleX = standardPageWidth / rect.width;
    const scaleY = standardPageHeight / rect.height;
    
    // Convert DOM pixels to PDF points
    const pdfX = clickX * scaleX;
    const pdfY_DOM = clickY * scaleY;
    
    // Flip Y-axis for PDF coordinate system (API expects flipped Y)
    // Top-left = (0, 842), Bottom-right = (595, 0)
    const pdfY = standardPageHeight - pdfY_DOM;

    // Ensure position is within bounds
    const boundedX = Math.max(0, Math.min(pdfX, standardPageWidth));
    const boundedY = Math.max(0, Math.min(pdfY, standardPageHeight));
    
    console.log(`🎯 Click position calculation:
      - Click coordinates: (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) [DOM pixels]
      - Page size: ${rect.width.toFixed(1)} x ${rect.height.toFixed(1)} [DOM]
      - A4 standard: ${standardPageWidth} x ${standardPageHeight} [PDF points]
      - Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}
      - PDF coordinates (DOM): (${pdfX.toFixed(1)}, ${pdfY_DOM.toFixed(1)})
      - PDF coordinates (flipped): (${pdfX.toFixed(1)}, ${pdfY.toFixed(1)})
      - Final bounded position: (${boundedX.toFixed(1)}, ${boundedY.toFixed(1)})`);
    
    onPositionClick(boundedX, boundedY, currentPageIndex);
  }, [onPositionClick, showSignatureMode, currentPageIndex]);

  // Handle scroll tracking for overlay positioning with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let animationFrameId: number;
    
    const handleScroll = () => {
      // Use requestAnimationFrame for smooth updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (viewerRef.current) {
          setScrollTop(viewerRef.current.scrollTop);
          // Force re-render of pins with new positions
          setRefreshKey(prev => prev + 1);
        }
      });
    };

    const handleResize = () => {
      // Clear previous timeout
      clearTimeout(timeoutId);
      
      // Debounce resize events
      timeoutId = setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 100);
    };

    const viewer = viewerRef.current;
    if (viewer) {
      viewer.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize, { passive: true });
      
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        clearTimeout(timeoutId);
        viewer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Force refresh when signature positions change - use useMemo to avoid infinite loop
  const positionsHash = useMemo(() => {
    return signaturePositions.map(p => `${p.x}-${p.y}-${p.page}`).join(',');
  }, [signaturePositions]);
  
  useEffect(() => {
    if (positionsHash) {
      setRefreshKey(prev => prev + 1);
    }
  }, [positionsHash]);

  // Auto-refresh interval for smooth pin positioning during scroll/zoom
  // Use longer interval (300ms) to allow X button clicks
  useEffect(() => {
    if (signaturePositions.length > 0) {
      const intervalId = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 300); // 300ms refresh rate - enough for smooth updates but allows X clicks

      return () => clearInterval(intervalId);
    }
  }, [signaturePositions.length]);

  // Force refresh when page changes
  useEffect(() => {
    // console.log('Page index changed to:', currentPageIndex);
    setRefreshKey(prev => prev + 1);
  }, [currentPageIndex]);

  // Force refresh when zoom scale changes to reposition pins
  useEffect(() => {
    console.log('Zoom scale changed to:', scale, 'Refreshing pin positions');
    setRefreshKey(prev => prev + 1);
  }, [scale]);

  // Remove problematic interval - only refresh on actual changes

  // Refresh signature positions
  const refreshPositions = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Page navigation functions
  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  // Open PDF in new tab
  const downloadPDF = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  // Filter positions and blocks for current page - fix the wrong page numbering
  const currentPageNumber = currentPageIndex + 1;
  
  // Use actual page filtering based on corrected page numbers
  // Group pins by the page they were actually clicked on, not by index
  const currentPagePositions = signaturePositions.filter((pos, index) => {
    // For 2-page document, try to determine which page each pin was actually intended for
    if (totalPages === 2) {
      // Use the page where the pin was actually clicked (actualPage from click handler)
      // Since stored page numbers are wrong, we'll use a different approach:
      // Look at the stored page number and map it to correct pages
      
      // The stored page is already correct (1-based), so use it directly
      const actualPage = pos.page;
      const shouldBeOnCurrentPage = actualPage === currentPageNumber;
      
      // Only log when debugging is needed (comment out for production)
      // console.log(`Position ${index} (${pos.signer.name}): storedPage=${pos.page}, actualPage=${actualPage}, currentPageNumber=${currentPageNumber}, shouldShow=${shouldBeOnCurrentPage}`);
      
      return shouldBeOnCurrentPage;
    } else {
      // For multi-page documents, use original logic but fix page numbers
      const correctedPage = Math.min(pos.page - 1, totalPages - 1); // Convert to 0-based and clamp
      return correctedPage === currentPageIndex;
    }
  });
  
  // Only log page filtering info when needed for debugging
  // console.log('🔍 Page filtering with page mapping:', {
  //   currentPageIndex,
  //   currentPageNumber,
  //   totalPages,
  //   totalPositions: signaturePositions.length,
  //   filteredCount: currentPagePositions.length,
  //   allPositions: signaturePositions.map((p, i) => ({ 
  //     index: i, 
  //     name: p.signer.name, 
  //     storedPage: p.page,
  //     actualPage: p.page, // No mapping needed, stored page is correct
  //   })),
  //   currentPagePositions: currentPagePositions.map((p, i) => ({ index: i, name: p.signer.name, storedPage: p.page }))
  // });
  const currentPageBlocks = signatureBlocks.filter(block => 
    block.position.page === (currentPageIndex) && block.visible
  );

  const roleColors = {
    clerk: 'bg-purple-500',
    author: 'bg-blue-500',
    assistant_director: 'bg-green-500',
    deputy_director: 'bg-yellow-500',
    director: 'bg-red-500'
  };

  if (!fileUrl || !isValidPDF(fileUrl)) {
    return (
    <Card className="w-full border rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-50 border-b px-4 py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {fileName || 'ไม่มีไฟล์'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            {error || 'ไม่มีไฟล์ PDF ให้แสดง'}
          </p>
          {fileUrl && (
            <Button variant="outline" onClick={downloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              ดาวน์โหลดไฟล์
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fullscreen wrapper style (CSS-based overlay)
  const fullscreenWrapperStyle: React.CSSProperties | undefined = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }
    : undefined;

  // Content rotation style inside fullscreen
  const fullscreenContentStyle: React.CSSProperties | undefined =
    isFullscreen && isRotated
      ? {
          transform: 'rotate(90deg)',
          transformOrigin: 'center center',
          width: '100vh',
          height: 'calc(100vw - 44px)',
          position: 'relative' as const,
          left: '50%',
          top: '50%',
          marginLeft: '-50vh',
          marginTop: 'calc(-50vw + 22px)',
        }
      : undefined;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pdfViewerStyles }} />
      <div ref={fullscreenWrapperRef} style={fullscreenWrapperStyle}>
        {/* Floating toolbar in fullscreen mode */}
        {isFullscreen && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/80 backdrop-blur-sm flex-shrink-0" style={{ zIndex: 100000 }}>
            <span className="text-white text-sm truncate max-w-[40%]">{fileName}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleRotation}
                className="text-white hover:bg-white/20 h-8 px-2">
                <RotateCw className="h-4 w-4 mr-1" />
                <span className="text-xs">{isRotated ? 'แนวตั้ง' : 'แนวนอน'}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={exitFullscreen}
                className="text-white hover:bg-white/20 h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
        <div className={isFullscreen ? 'flex-1 overflow-hidden' : ''} style={fullscreenContentStyle}>
      <Card className="w-full" style={isFullscreen ? { borderRadius: 0, border: 'none', height: '100%' } : undefined}>
        <CardHeader className="bg-gray-50 border-b px-4 py-3" style={isFullscreen ? { display: 'none' } : undefined}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{fileName}</span>
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Page Navigation Controls */}
              {totalPages > 0 && !editMode && !showSignatureMode && (
                <span className="text-xs font-medium px-1.5 py-0.5 text-gray-600 whitespace-nowrap">
                  {currentPageIndex + 1}/{totalPages}
                </span>
              )}
              {totalPages > 0 && (editMode || showSignatureMode) && (
                <div className="flex items-center gap-0.5 bg-white border rounded-md px-1 py-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={goToPreviousPage}
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-medium px-1 text-gray-700">
                    {currentPageIndex + 1}/{totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={goToNextPage}
                    disabled={currentPageIndex === totalPages - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Zoom Controls */}
              {showZoomControls && (
                <div className="flex items-center gap-0.5 bg-white border rounded-md px-1 py-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const newScale = Math.max(0.5, scale - 0.25);
                      setScale(newScale);
                      zoomTo(newScale);
                    }}
                    disabled={scale <= 0.5}
                  >
                    <span className="text-sm font-bold">−</span>
                  </Button>
                  <span className="text-xs font-medium px-1 text-gray-700 min-w-[36px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const newScale = Math.min(3, scale + 0.25);
                      setScale(newScale);
                      zoomTo(newScale);
                    }}
                    disabled={scale >= 3}
                  >
                    <span className="text-sm font-bold">+</span>
                  </Button>
                </div>
              )}

              {signaturePositions.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={refreshPositions}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={downloadPDF}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              {showFullscreenButton && (
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={enterFullscreen} title="ดูเต็มจอ">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      
      <CardContent className="p-0 overflow-hidden" style={isFullscreen ? { flex: 1 } : undefined}>
        <div
          ref={containerRef}
          className={`relative w-full overflow-hidden ${showSignatureMode ? 'cursor-crosshair' : ''}`}
          style={{ height: isFullscreen ? '100%' : '600px' }}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-50">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-3"></div>
              <p className="text-xs text-gray-600">กำลังโหลด PDF...</p>
            </div>
          )}

          <Worker workerUrl="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js">
            <div 
              ref={viewerRef}
              style={{ 
                height: '100%', 
                width: '100%',
                overflow: 'auto', // Ensure scrolling is handled correctly
                position: 'relative'
              }}
              onClick={handlePageClick}
            >
              {blobUrl && (
                <Viewer
                  fileUrl={blobUrl}
                  plugins={[defaultLayoutPluginInstance, zoomPluginInstance]}
                  onPageChange={handlePageChange}
                  onDocumentLoad={handleDocumentLoad}
                />
              )}
            </div>
          </Worker>

          {/* Signature Position Overlay */}
          {signaturePositions.length > 0 && (
            <div 
              className="absolute inset-0 pointer-events-none z-40"
              style={{ overflow: 'visible' }}
            >
              {currentPagePositions.map((pos, index) => {
                const isClerk = pos.signer.role === 'clerk';
                const roleColor = roleColors[pos.signer.role as keyof typeof roleColors] || 'bg-gray-500';
                
                // Use the correct page element selector - use data-testid which is more reliable
                let pageElement = viewerRef.current?.querySelector(`[data-testid="core__page-layer-${currentPageIndex}"]`);
                
                // Fallback to class-based selector if data-testid doesn't work
                if (!pageElement) {
                  pageElement = viewerRef.current?.querySelector(`.rpv-core__page-layer:nth-child(${currentPageIndex + 1})`);
                }

                // Last fallback: get all page layers and pick by index
                if (!pageElement) {
                  const allPages = viewerRef.current?.querySelectorAll('.rpv-core__page-layer');
                  if (allPages && allPages[currentPageIndex]) {
                    pageElement = allPages[currentPageIndex];
                  }
                }
                
                if (!pageElement) {
                  return null; // Silently skip if page not found
                }

                const pageRect = pageElement.getBoundingClientRect();
                const viewerRect = viewerRef.current?.getBoundingClientRect();

                if (!pageRect || !viewerRect) {
                  return null;
                }

                // Calculate zoom level based on page width - ใช้ scale state ที่มีอยู่
                // A4 = 595 x 842 points (8.27 x 11.69 inches)
                const standardPageWidth = 595; // A4 width in points
                const standardPageHeight = 842; // A4 height in points
                const currentZoom = scale; // ใช้ scale state จาก zoomPlugin แทนการคำนวณใหม่
                
                // Calculate pin size based on current PDF page dimensions
                const basePinSizePt = 180; // Base pin size in points (increased for more content space)
                
                // Use current PDF page dimensions directly for calculation
                const currentPageWidth = pageRect.width; // Current PDF page width in pixels
                const currentPageHeight = pageRect.height; // Current PDF page height in pixels
                
                // Scale pin size proportionally with PDF page size
                // Use the smaller dimension to maintain square pins
                const pdfSizeScale = Math.min(currentPageWidth, currentPageHeight) / 500; // Normalize against 500px base
                
                const calculatedSize = basePinSizePt * pdfSizeScale;
                
                // Apply min/max constraints
                const minPinSize = 30; // Minimum size in pixels
                const maxPinSize = 200; // Maximum size in pixels
                const basePinSize = Math.max(minPinSize, Math.min(maxPinSize, calculatedSize));
                const pinWidth = basePinSize;
                const pinHeight = basePinSize;
                
                // Calculate position that sticks to the PDF page
                // pos.x, pos.y อยู่ในหน่วย PDF points แล้ว แต่ Y-axis ถูก flipped
                // ต้องแปลงกลับเป็น DOM pixels โดย flip Y-axis กลับ
                
                // Calculate scale factors to convert PDF points back to DOM pixels
                const scaleX = pageRect.width / standardPageWidth;   // DOM width / PDF width
                const scaleY = pageRect.height / standardPageHeight; // DOM height / PDF height

                // Pin sizing calculation (logging disabled for performance)
                
                // Calculate position as PERCENTAGE of PDF page (sticks naturally!)
                const leftPercent = (pos.x / standardPageWidth) * 100;
                const pdfY_DOM = standardPageHeight - pos.y;
                const topPercent = (pdfY_DOM / standardPageHeight) * 100;

                // Convert to DOM pixels for now (will use percentage later)
                const displayX = pos.x * scaleX;
                const displayY = pdfY_DOM * scaleY;

                // Position relative to the viewer container
                const finalX = displayX + pageRect.left - viewerRect.left;
                const finalY = displayY + pageRect.top - viewerRect.top;

                // Check if pin is visible in viewport
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const pinMargin = pinHeight; // Use pin height as margin to show pins that are partially visible
                
                const isVisible = finalX >= -pinMargin && 
                                finalX <= viewportWidth + pinMargin && 
                                finalY >= -pinMargin && 
                                finalY <= viewportHeight + pinMargin;

                // Calculate coordinates that match API usage
                // pos.x, pos.y is the actual position in PDF (not zoomed)
                const apiX = Math.round(pos.x); // This is the actual X that API will use
                const apiY = Math.round(pos.y); // This is the actual Y that API will use

                // Position calculation (logging disabled for performance)

                // Only render pin if it's visible or close to viewport
                if (!isVisible) {
                  return null;
                }

                // Only log rendering when debugging is needed
                // console.log(`✅ Rendering pin ${index} (${pos.signer.name}):`, { 
                //   pos: { x: pos.x, y: pos.y },
                //   pageRect: { top: pageRect.top, left: pageRect.left, width: pageRect.width, height: pageRect.height },
                //   viewerRect: { top: viewerRect.top, left: viewerRect.left },
                //   scrollTop,
                //   calculated: { finalX, finalY }
                // });

                // Get role color RGB values for transparency
                const roleColorMap = {
                  'bg-purple-500': '168, 85, 247',
                  'bg-blue-500': '59, 130, 246',
                  'bg-green-500': '34, 197, 94',
                  'bg-yellow-500': '234, 179, 8',
                  'bg-red-500': '239, 68, 68',
                  'bg-gray-500': '107, 114, 128'
                };
                const bgColorRGB = roleColorMap[roleColor as keyof typeof roleColorMap] || roleColorMap['bg-gray-500'];

                return (
                  <div
                    key={`signature-pin-${index}-page-${currentPageNumber}-${pos.signer.order}`}
                    className={`absolute rounded-xl border border-white/50 shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm`}
                    style={{
                      position: 'absolute',
                      left: `${finalX}px`,
                      top: `${finalY}px`,
                      width: `${pinWidth}px`, // Dynamic width based on zoom
                      height: `${pinHeight}px`, // Dynamic height based on zoom
                      padding: `${Math.max(2, basePinSize * 0.05)}px`, // Scale padding with pin size (5%)
                      transform: 'translate(-50%, 0%)', // Pin positioned above click point
                      zIndex: 999,
                      pointerEvents: 'auto', // เปลี่ยนเป็น auto เพื่อให้ปุ่ม X คลิกได้
                      background: `rgba(${bgColorRGB}, 0.25)`, // Fixed opacity
                      backdropFilter: 'blur(4px)', // Reduced blur for more visibility
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)', // Lighter shadow
                      overflow: 'visible' // เพิ่มเพื่อให้ปุ่ม X แสดงออกนอกขอบ
                    }}
                  >
                    {/* ปุ่ม X ลบตำแหน่ง - ใช้ onPointerDown เพื่อจับคลิกทันทีก่อน re-render */}
                    {onPositionRemove && (
                      <button
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const idx = signaturePositions.indexOf(pos);
                          if (idx !== -1) {
                            onPositionRemove(idx);
                          }
                        }}
                        className="absolute w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg transition-all duration-200 hover:scale-110"
                        style={{
                          top: '0px',
                          right: '0px',
                          border: '3px solid white',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                          zIndex: 10001,
                          fontSize: '16px',
                          transform: 'translate(50%, -50%)',
                          cursor: 'pointer',
                          touchAction: 'manipulation' // ป้องกัน delay บน touch devices
                        }}
                        title="ลบตำแหน่งลายเซ็น"
                      >
                        ×
                      </button>
                    )}

                    {/* Signer Info Tag */}
                    <div 
                      className="rounded-lg text-center w-full h-full flex flex-col justify-center relative"
                      onClick={(e) => e.stopPropagation()} // ป้องกันการ propagate click
                      style={{
                        fontSize: '8px', // Fixed font size at 8px
                        padding: `${Math.max(2, basePinSize * 0.03)}px ${Math.max(3, basePinSize * 0.04)}px`, // Padding based on pin size
                        background: 'rgba(255, 255, 255, 0.3)', // Much more transparent white background
                        backdropFilter: 'blur(2px)', // Reduced blur
                        border: '1px solid rgba(0, 0, 0, 0.05)', // Very light border
                        color: '#1f2937', // Dark gray text for better contrast
                        fontFamily: 'system-ui, -apple-system, sans-serif', // Better Thai font support
                        textRendering: 'optimizeLegibility', // Better text rendering
                        WebkitFontSmoothing: 'antialiased' // Smooth font rendering
                      }}
                    >
                      {/* ลบ ปุ่ม X ที่เคยอยู่ที่นี่ */}

                      {/* แสดงเนื้อหาต่างกันตาม role */}
                      {isClerk ? (
                        /* สำหรับธุรการ - แสดงไอคอนตราประทับแทนลายเซ็น */
                        <>
                          <div className="mb-2 flex justify-center items-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                width: `${Math.max(40, basePinSize * 0.5)}px`,
                                height: `${Math.max(40, basePinSize * 0.5)}px`,
                                color: '#9333ea' // Purple color for clerk
                              }}
                            >
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          </div>
                          <div className="font-semibold truncate leading-tight text-purple-600" style={{ fontSize: '14px' }}>
                            ตำแหน่งตราประทับ
                          </div>
                          <div className="truncate leading-tight text-gray-600" style={{ fontSize: '12px' }}>
                            ธุรการ
                          </div>
                        </>
                      ) : (
                        /* สำหรับผู้ลงนามทั่วไป - แสดงลายเซ็นและชื่อ */
                        <>
                          {/* ลายเซ็น - อยู่บนสุดขนาดใหญ่พอดีกรอบ */}
                          {pos.signer.signature_url && (
                            <div className="mb-2 flex justify-center items-center">
                              <img
                                src={pos.signer.signature_url}
                                alt="ลายเซ็น"
                                style={{
                                  maxWidth: '95%', // เพิ่มเป็น 95% ให้ใหญ่พอดีกรอบ
                                  maxHeight: `${Math.max(40, basePinSize * 0.7)}px`, // Scale signature height with pin size (70%)
                                  width: 'auto',
                                  height: 'auto',
                                  objectFit: 'contain',
                                  opacity: 0.9,
                                  margin: '0 auto'
                                }}
                              />
                            </div>
                          )}

                          {/* ชื่อ - แสดงตามที่มีอยู่พร้อมหมายเลขตำแหน่ง */}
                          <div className="font-semibold truncate leading-tight text-gray-800" style={{ fontSize: '14px' }}>
                            {pos.signer.name}
                            {(pos.signer as any).positionIndex && (pos.signer as any).positionIndex > 1 && (
                              <span className="ml-1 text-blue-600 font-bold">
                                ({(pos.signer as any).positionIndex})
                              </span>
                            )}
                          </div>

                          {/* ตำแหน่ง - แตกต่างตามบทบาท */}
                          <div
                            className="truncate leading-tight text-gray-600"
                            style={{ fontSize: '12px' }} // Fixed font size for position
                          >
                            {pos.signer.role === 'author' && `ตำแหน่ง ${pos.signer.academic_rank || pos.signer.job_position || pos.signer.position || ''}`}
                            {pos.signer.role === 'assistant_director' && `ตำแหน่ง ${pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || ''}`}
                            {pos.signer.role === 'deputy_director' && `ตำแหน่ง ${pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || ''}`}
                            {pos.signer.role === 'director' && `${pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || ''}`}
                          </div>

                          {/* บรรทัดเพิ่มเติม - แตกต่างตามบทบาท */}
                          <div
                            className="leading-tight text-gray-500"
                            style={{ fontSize: '12px' }} // Fixed font size for additional info
                          >
                            {pos.signer.role === 'assistant_director' && `ปฏิบัติหน้าที่ ${pos.signer.org_structure_role || 'หัวหน้าฝ่าย'}`}
                            {pos.signer.role === 'deputy_director' && (memo?.updated_at ? formatThaiDate(memo.updated_at) : '๑๑ กรกฎาคม ๒๕๖๘')}
                            {pos.signer.role === 'director' && `เขตการศึกษา ๖ จังหวัดลพบุรี`}
                          </div>
                        </>
                      )}
                      
                      {/* พิกัด API */}
                      <div 
                        key={`coords-${index}-${pos.x}-${pos.y}-${pinHeight}`}
                        className="leading-tight text-gray-400"
                        style={{ fontSize: '12px' }} // Fixed font size for API coordinates
                      >
                        P{currentPageNumber} (API: {apiX},{apiY})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Signature Blocks */}
          {signatureBlocks && signatureBlocks.length > 0 && signatureBlocks.map((block) => (
            <div
              key={block.id}
              className={`absolute border-2 border-white rounded-lg shadow-lg pointer-events-none ${roleColors[block.role]} ${editMode ? 'border-dashed border-blue-500' : ''} z-30`}
              style={{
                left: block.position.x,
                top: block.position.y,
                width: '200px',
                height: '90px',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="p-2 text-white text-xs bg-black bg-opacity-75 rounded">
                <div className="font-medium truncate">{block.role}</div>
                <div className="opacity-90">หน้า {block.position.page + 1}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Signature Mode Instructions */}
        {showSignatureMode && (
          <div className="px-4 py-3 bg-blue-50 border-t">
            <p className="text-sm text-blue-800 flex items-center">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
              คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น (หน้า {currentPageIndex + 1})
            </p>
          </div>
        )}

        {/* Signature Positions List */}
        {signaturePositions.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t">
            <h4 className="font-medium text-gray-800 mb-2 text-sm">
              ตำแหน่งลายเซ็น ({signaturePositions.length} ตำแหน่ง):
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {signaturePositions.map((pos, index) => {
                const roleColor = roleColors[pos.signer.role as keyof typeof roleColors] || 'bg-gray-500';
                
                return (
                  <div key={index} className="text-xs text-gray-600 flex items-center p-2 bg-white rounded border">
                    <span className={`w-6 h-6 ${roleColor} text-white rounded-full text-center text-xs mr-3 flex-shrink-0 flex items-center justify-center font-medium`}>
                      {pos.signer.order}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">
                        {pos.signer.name}
                        {(pos.signer as any).positionIndex && (pos.signer as any).positionIndex > 1 && (
                          <span className="ml-1 text-blue-600 font-bold text-xs">
                            (ตำแหน่งที่ {(pos.signer as any).positionIndex})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        หน้า {pos.page}: X={Math.round(pos.x)}, Y={Math.round(pos.y)}
                        {pos.comment && ` - "${pos.comment}"`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
        </div>{/* close rotation/fullscreen content div */}

        {/* Close rotation overlay button (non-fullscreen rotated mode) */}
        {isRotated && !isFullscreen && showFullscreenButton && (
          <div className="fixed top-3 right-3 z-[10000]">
            <Button variant="secondary" size="sm" onClick={toggleRotation}
              className="shadow-lg h-9 px-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <RotateCw className="h-4 w-4 mr-1" />
              แนวตั้ง
            </Button>
          </div>
        )}
      </div>{/* close fullscreenWrapperRef div */}
    </>
  );
};

export default PDFViewer;