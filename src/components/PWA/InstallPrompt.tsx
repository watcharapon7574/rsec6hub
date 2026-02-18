import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';
import FastDocLogo from '@/components/ui/FastDocLogo';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isTelegramMiniApp = () => {
  return !!(window as any).Telegram?.WebApp?.initData || window.location.pathname.startsWith('/telegram');
};

const isStandalone = () => {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
};

const InstallPrompt: React.FC = () => {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // ไม่แสดงบน iOS, Telegram Mini App, หรือถ้าติดตั้งแล้ว
    if (isIOS() || isTelegramMiniApp() || isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // ตรวจสอบว่าเคย dismiss แล้วหรือยัง (ใช้ localStorage เพื่อจำข้ามเซสชัน)
    if (localStorage.getItem('pwa-prompt-dismissed')) {
      return;
    }

    // ตรวจสอบ event ที่จับไว้ใน index.html ก่อน React mount (ป้องกันพลาด event)
    // เก็บ __pwaInstallPrompt ไว้ให้หน้า auth page ใช้ได้ด้วย (ไม่ลบออก)
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt as BeforeInstallPromptEvent);
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    // Listen for the beforeinstallprompt event (Chrome/Edge on Android/Desktop only)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // เก็บไว้ใน global ให้ปุ่มดาวน์โหลดบนหน้า login ใช้ได้ด้วย
      (window as any).__pwaInstallPrompt = e;

      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
    (window as any).__pwaInstallPrompt = null;
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // ไม่แสดงถ้าติดตั้งแล้ว, ไม่มี prompt จาก browser, หรืออยู่หน้า login (มีปุ่มดาวน์โหลดของตัวเองแล้ว)
  if (isInstalled || !showPrompt || !deferredPrompt || location.pathname === '/auth') return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 sm:max-w-sm">
      <Card className="bg-card shadow-lg border border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <FastDocLogo className="h-8 w-8" showText={false} />
              <h3 className="font-semibold text-foreground">ติดตั้งแอป</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            ติดตั้ง FastDoc บนอุปกรณ์ของคุณเพื่อการเข้าใช้งานที่รวดเร็วและสะดวก
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              ติดตั้ง
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
              className="px-3"
            >
              ไว้ทีหลัง
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallPrompt;
