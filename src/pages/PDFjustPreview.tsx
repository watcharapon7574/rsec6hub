import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { ArrowLeft, Maximize2, RotateCw, Smartphone, X } from 'lucide-react';
import { useAllMemos } from '@/hooks/useAllMemos';

// ตรวจสอบว่าเป็นมือถือ (จอแคบ)
const isMobileScreen = () => window.innerWidth < 768;

const PDFjustPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getMemoById } = useAllMemos();

  // รับ url และชื่อไฟล์จาก state หรือ query
  const { fileUrl, fileName, memoId } = location.state || {};

  const [memo, setMemo] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  // Fullscreen + Rotation state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 or 90
  const [orientationLocked, setOrientationLocked] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMemoData = async () => {
      if (memoId && getMemoById) {
        try {
          const memoData = await getMemoById(memoId);
          if (memoData) {
            setMemo(memoData);

            // Parse attached files
            let files = [];
            if (memoData.attached_files) {
              try {
                if (typeof memoData.attached_files === 'string') {
                  const parsed = JSON.parse(memoData.attached_files);
                  files = Array.isArray(parsed) ? parsed : [];
                } else if (Array.isArray(memoData.attached_files)) {
                  files = memoData.attached_files;
                }
              } catch {
                files = [];
              }
            }
            setAttachedFiles(files);
          }
        } catch (error) {
          console.error('Error loading memo:', error);
        }
      }
    };

    loadMemoData();
  }, [memoId, getMemoById]);

  // Try to lock screen orientation (mobile only)
  // ใช้ any เพราะ TypeScript DOM lib ยังไม่มี lock/unlock ในบาง version
  const lockLandscape = useCallback(async () => {
    try {
      const orientation = screen.orientation as any;
      if (orientation?.lock) {
        await orientation.lock('landscape');
        setOrientationLocked(true);
        return true;
      }
    } catch {
      // Screen Orientation API ไม่รองรับหรือถูกบล็อก
    }
    return false;
  }, []);

  const unlockOrientation = useCallback(() => {
    try {
      const orientation = screen.orientation as any;
      if (orientation?.unlock) {
        orientation.unlock();
      }
    } catch {
      // ignore
    }
    setOrientationLocked(false);
  }, []);

  // Fullscreen: เข้า fullscreen → มือถือ auto-lock landscape
  const enterFullscreen = useCallback(async () => {
    try {
      await fullscreenRef.current?.requestFullscreen();
      // มือถือ: พยายาม lock landscape อัตโนมัติ
      if (isMobileScreen()) {
        const locked = await lockLandscape();
        // ถ้า lock ไม่ได้ → fallback ใช้ CSS rotation
        if (!locked) {
          setRotation(90);
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [lockLandscape]);

  const exitFullscreen = useCallback(async () => {
    try {
      unlockOrientation();
      setRotation(0);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, [unlockOrientation]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await enterFullscreen();
    } else {
      await exitFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  // Listen for fullscreen changes (e.g. user presses Esc)
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) {
        // ออก fullscreen → reset ทุกอย่าง
        unlockOrientation();
        setRotation(0);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [unlockOrientation]);

  // Manual rotation toggle (สำหรับปุ่มหมุน)
  const toggleRotation = useCallback(async () => {
    if (rotation === 0) {
      // พยายาม lock landscape ก่อน
      if (isFullscreen) {
        const locked = await lockLandscape();
        if (!locked) {
          setRotation(90); // fallback CSS
        }
      } else {
        setRotation(90);
      }
    } else {
      // กลับแนวตั้ง
      unlockOrientation();
      setRotation(0);
    }
  }, [rotation, isFullscreen, lockLandscape, unlockOrientation]);

  const isRotated = rotation === 90;
  const isLandscapeByApi = orientationLocked && !isRotated;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-6 pb-24">
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* Header with back + fullscreen + rotate buttons */}
        <div className="flex items-center justify-between px-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับ
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRotation}
              className="flex items-center gap-1.5"
              title={isRotated || isLandscapeByApi ? 'แนวตั้ง' : 'แนวนอน'}
            >
              <RotateCw className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{isRotated || isLandscapeByApi ? 'แนวตั้ง' : 'แนวนอน'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5"
              title="ดูเต็มจอ (มือถือจะหมุนเป็นแนวนอนอัตโนมัติ)"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">เต็มจอ</span>
            </Button>
          </div>
        </div>

        {/* Mobile hint */}
        {isMobileScreen() && !isFullscreen && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300 mx-2">
            <Smartphone className="h-4 w-4 flex-shrink-0" />
            กด "เต็มจอ" เพื่อดูแนวนอนอัตโนมัติ
          </div>
        )}

        {/* PDF Viewer with fullscreen wrapper */}
        <div
          ref={fullscreenRef}
          className={isFullscreen ? 'bg-black flex flex-col' : ''}
          style={isFullscreen ? { width: '100vw', height: '100vh' } : undefined}
        >
          {/* Floating toolbar in fullscreen mode */}
          {isFullscreen && (
            <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-sm z-50 flex-shrink-0">
              <span className="text-white text-sm truncate max-w-[50%]">
                {fileName || 'ไฟล์ PDF'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleRotation}
                  className="text-white hover:bg-white/20 h-8 px-2"
                  title={isRotated || isLandscapeByApi ? 'แนวตั้ง' : 'แนวนอน'}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  <span className="text-xs">{isRotated || isLandscapeByApi ? 'แนวตั้ง' : 'แนวนอน'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitFullscreen}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="ออกจากเต็มจอ"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* PDF content area - CSS rotation fallback when orientation API not available */}
          <div
            className={isFullscreen ? 'flex-1 overflow-hidden' : ''}
            style={
              isFullscreen && isRotated
                ? {
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center center',
                    width: '100vh',
                    height: 'calc(100vw - 48px)',
                    position: 'relative',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-50vh',
                    marginTop: 'calc(-50vw + 24px)',
                  }
                : isRotated && !isFullscreen
                  ? {
                      transform: 'rotate(90deg)',
                      transformOrigin: 'center center',
                      width: '100vh',
                      height: '100vw',
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      marginLeft: '-50vh',
                      marginTop: '-50vw',
                      zIndex: 9999,
                      background: 'var(--background, white)',
                    }
                  : undefined
            }
          >
            <PDFViewer
              fileUrl={fileUrl}
              fileName={fileName || 'ไฟล์ PDF'}
              editMode={false}
              showSignatureMode={false}
              showZoomControls={true}
              showFullscreenButton={true}
            />
          </div>

          {/* Close rotation overlay button (non-fullscreen rotated mode) */}
          {isRotated && !isFullscreen && (
            <div className="fixed top-3 right-3 z-[10000]">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleRotation}
                className="shadow-lg h-9 px-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
              >
                <RotateCw className="h-4 w-4 mr-1" />
                แนวตั้ง
              </Button>
            </div>
          )}
        </div>

        {/* Show attached files accordion if available */}
        {attachedFiles.length > 0 && (
          <Accordion
            attachments={attachedFiles}
            attachmentTitle={memo?.attachment_title}
          />
        )}

        {/* Spacer for FloatingNavbar */}
        <div className="h-32" />
      </div>
    </div>
  );
};

export default PDFjustPreview;
