import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  X
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Ensure position is within bounds
    const boundedX = Math.max(0, Math.min(x, rect.width));
    const boundedY = Math.max(0, Math.min(y, rect.height));
    
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

  // Force refresh when signature positions change
  useEffect(() => {
    // console.log('Signature positions changed:', signaturePositions);
    setRefreshKey(prev => prev + 1);
  }, [signaturePositions]);

  // Force refresh when page changes
  useEffect(() => {
    // console.log('Page index changed to:', currentPageIndex);
    setRefreshKey(prev => prev + 1);
  }, [currentPageIndex]);

  // Add interval to periodically refresh positions (as backup)
  useEffect(() => {
    const interval = setInterval(() => {
      if (signaturePositions.length > 0) {
        setRefreshKey(prev => prev + 1);
      }
    }, 1000); // Refresh every second

    return () => clearInterval(interval);
  }, [signaturePositions.length]);

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

  // Download PDF
  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pdfViewerStyles }} />
      <Card className="w-full">
        <CardHeader className="bg-gray-50 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{fileName}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Page Navigation Controls */}
              {totalPages > 0 && !editMode && !showSignatureMode && (
                <div className="flex items-center justify-center w-full">
                  <span className="text-base font-semibold px-2 text-gray-700 bg-white bg-opacity-80 rounded shadow-sm">
                    {currentPageIndex + 1} / {totalPages}
                  </span>
                </div>
              )}
              {totalPages > 0 && (editMode || showSignatureMode) && (
                <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={goToPreviousPage}
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-2 text-gray-700">
                    {currentPageIndex + 1} / {totalPages}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={goToNextPage}
                    disabled={currentPageIndex === totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {/* Zoom Controls */}
              {showZoomControls && (
                <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const newScale = Math.max(0.5, scale - 0.25);
                      setScale(newScale);
                      zoomTo(newScale);
                    }}
                    disabled={scale <= 0.5}
                  >
                    <span className="text-lg font-bold">−</span>
                  </Button>
                  <span className="text-sm font-medium px-2 text-gray-700 min-w-[60px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const newScale = Math.min(3, scale + 0.25);
                      setScale(newScale);
                      zoomTo(newScale);
                    }}
                    disabled={scale >= 3}
                  >
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>
              )}
              
              {signaturePositions.length > 0 && (
                <Button size="sm" variant="outline" onClick={refreshPositions}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={downloadPDF}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      
      <CardContent className="p-0 overflow-hidden">
        <div 
          ref={containerRef}
          className={`relative w-full overflow-hidden ${showSignatureMode ? 'cursor-crosshair' : ''}`}
          style={{ height: '600px' }}
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
                const roleColor = roleColors[pos.signer.role as keyof typeof roleColors] || 'bg-gray-500';
                
                // Use the correct page element selector - use data-testid which is more reliable
                const pageElement = viewerRef.current?.querySelector(`[data-testid="core__page-layer-${currentPageIndex}"]`);
                
                if (!pageElement) {
                  return null;
                }

                const pageRect = pageElement.getBoundingClientRect();
                const viewerRect = viewerRef.current?.getBoundingClientRect();

                if (!pageRect || !viewerRect) {
                  return null;
                }

                // Calculate zoom level based on page width
                // Standard PDF page width is approximately 595pt (A4), convert to pixels at 96 DPI: 595 * 96/72 ≈ 793px
                const standardPageWidth = 793; // pixels at 100% zoom
                const currentZoom = pageRect.width / standardPageWidth;
                
                // Target pin size: 150pt width x 150pt height (square shape)
                // Convert points to pixels: pt * 96/72 = pt * 1.333
                const targetWidthPt = 150;
                const targetHeightPt = 150; // Same as width for square
                const pinWidth = (targetWidthPt * 96 / 72) * currentZoom; // Convert pt to px and apply zoom
                const pinHeight = (targetHeightPt * 96 / 72) * currentZoom; // Convert pt to px and apply zoom

                // Calculate position that sticks to the PDF page
                const scrollTop = viewerRef.current?.scrollTop || 0;
                const finalX = pos.x + pageRect.left - viewerRect.left;
                const finalY = pos.y + pageRect.top - viewerRect.top;

                // Calculate coordinates that match API usage
                // pos.x, pos.y is the click position (top-center of pin)
                // API uses: x = center, y = top
                // So pos.x = API x (center), pos.y = API y (top)
                const apiX = Math.round(pos.x); // This is the center X that API will use
                const apiY = Math.round(pos.y); // This is the top Y that API will use
                const cardCenterY = Math.round(pos.y + (pinHeight / 2)); // Visual center for display

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
                  'bg-blue-500': '59, 130, 246',
                  'bg-green-500': '34, 197, 94',
                  'bg-yellow-500': '234, 179, 8',
                  'bg-red-500': '239, 68, 68',
                  'bg-gray-500': '107, 114, 128'
                };
                const bgColorRGB = roleColorMap[roleColor as keyof typeof roleColorMap] || roleColorMap['bg-gray-500'];

                return (
                  <div
                    key={`signature-pin-${index}-page-${currentPageNumber}-${refreshKey}`}
                    className={`absolute rounded-xl border border-white/50 shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm`}
                    style={{
                      position: 'absolute',
                      left: `${finalX}px`,
                      top: `${finalY}px`,
                      width: `${pinWidth}px`, // Dynamic width based on zoom
                      height: `${pinHeight}px`, // Dynamic height based on zoom
                      padding: `${Math.max(2, 6 * currentZoom)}px`, // Scale padding with zoom
                      transform: 'translate(-50%, 0%)', // Pin positioned above click point
                      zIndex: 999,
                      pointerEvents: 'auto', // เปลี่ยนเป็น auto เพื่อให้ปุ่ม X คลิกได้
                      background: `rgba(${bgColorRGB}, 0.25)`, // Fixed opacity
                      backdropFilter: 'blur(4px)', // Reduced blur for more visibility
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)', // Lighter shadow
                      overflow: 'visible' // เพิ่มเพื่อให้ปุ่ม X แสดงออกนอกขอบ
                    }}
                  >
                    {/* ปุ่ม X ลบตำแหน่ง - วางนอก div เนื้อหา */}
                    {onPositionRemove && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPositionRemove(signaturePositions.indexOf(pos));
                        }}
                        className="absolute w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg transition-all duration-200 hover:scale-110"
                        style={{
                          top: '0px',
                          right: '0px',
                          border: '3px solid white',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                          zIndex: 10001,
                          fontSize: '16px',
                          transform: 'translate(50%, -50%)'
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
                        fontSize: `${Math.max(12, 16 * currentZoom)}px`, // Base 16pt scaling with zoom
                        padding: `${Math.max(3, 6 * currentZoom)}px ${Math.max(4, 8 * currentZoom)}px`, // เพิ่ม padding ให้เหมาะสม
                        background: 'rgba(255, 255, 255, 0.3)', // Much more transparent white background
                        backdropFilter: 'blur(2px)', // Reduced blur
                        border: '1px solid rgba(0, 0, 0, 0.05)', // Very light border
                        color: '#1f2937' // Dark gray text for better contrast
                      }}
                    >
                      {/* ลบ ปุ่ม X ที่เคยอยู่ที่นี่ */}
                      
                      {/* ลายเซ็น - อยู่บนสุดขนาดใหญ่พอดีกรอบ */}
                      {pos.signer.signature_url && (
                        <div className="mb-2 flex justify-center items-center">
                          <img 
                            src={pos.signer.signature_url}
                            alt="ลายเซ็น"
                            style={{
                              maxWidth: '95%', // เพิ่มเป็น 95% ให้ใหญ่พอดีกรอบ
                              maxHeight: `${Math.max(40, 60 * currentZoom)}px`, // เพิ่มขนาดให้ใหญ่และ responsive
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
                      <div className="font-semibold truncate leading-tight text-gray-800" style={{ fontSize: `${Math.max(12, 16 * currentZoom)}px` }}>
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
                        style={{ fontSize: `${Math.max(9, 12 * currentZoom)}px` }} // เปลี่ยนเป็น 12pt
                      >
                        {pos.signer.role === 'author' && `ตำแหน่ง ${pos.signer.academic_rank || pos.signer.position || ''}`}
                        {pos.signer.role === 'assistant_director' && `ตำแหน่ง ${pos.signer.academic_rank || pos.signer.position || ''}`}
                        {pos.signer.role === 'deputy_director' && `ตำแหน่ง ${pos.signer.org_structure_role || pos.signer.position || ''}`}
                        {pos.signer.role === 'director' && `ผู้อำนวยการศูนย์การศึกษาพิเศษ`}
                      </div>
                      
                      {/* บรรทัดเพิ่มเติม - แตกต่างตามบทบาท */}
                      <div 
                        className="leading-tight text-gray-500"
                        style={{ fontSize: `${Math.max(9, 12 * currentZoom)}px` }} // เปลี่ยนเป็น 12pt
                      >
                        {pos.signer.role === 'assistant_director' && `ปฏิบัติหน้าที่ ${pos.signer.org_structure_role || 'ผู้ช่วยผู้อำนวยการ'}`}
                        {pos.signer.role === 'deputy_director' && (memo?.updated_at ? formatThaiDate(memo.updated_at) : '๑๑ กรกฎาคม ๒๕๖๘')}
                        {pos.signer.role === 'director' && `เขตการศึกษา ๖ จังหวัดลพบุรี`}
                      </div>
                      
                      {/* พิกัด API */}
                      <div 
                        key={`coords-${index}-${pos.x}-${pos.y}-${pinHeight}`}
                        className="leading-tight text-gray-400"
                        style={{ fontSize: `${Math.max(8, 10 * currentZoom)}px` }} // เปลี่ยนเป็น 10pt
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
    </>
  );
};

export default PDFViewer;