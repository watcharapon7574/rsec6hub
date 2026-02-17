import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Globe } from 'lucide-react';
import FastDocLogo from '@/components/ui/FastDocLogo';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const isChrome = () => /Chrome/i.test(navigator.userAgent) && !/Edge|OPR|Samsung/i.test(navigator.userAgent);

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showChromeHint, setShowChromeHint] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setShowChromeHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Not Chrome (Android or PC) → show hint to switch to Chrome
    if (!isChrome()) {
      setTimeout(() => {
        if (!sessionStorage.getItem('pwa-chrome-hint-dismissed')) {
          setShowChromeHint(true);
        }
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowChromeHint(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
    sessionStorage.setItem('pwa-chrome-hint-dismissed', 'true');
  };

  // Don't show if already installed
  if (isInstalled) return null;

  // Check if user previously dismissed
  if (sessionStorage.getItem('pwa-prompt-dismissed')) {
    // Still show Chrome hint if on Android non-Chrome
    if (!showChromeHint) return null;
  }

  // Android non-Chrome: show "please use Chrome" hint
  if (showChromeHint && !deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 sm:max-w-sm">
        <Card className="bg-card shadow-lg border border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-orange-500" />
                <h3 className="font-semibold text-foreground">เปิดใน Chrome</h3>
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

            <p className="text-sm text-muted-foreground">
              เพื่อติดตั้ง FastDoc เป็นแอป กรุณาเปิดเว็บไซต์นี้ใน <strong>Google Chrome</strong> แล้วกด "ติดตั้ง"
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal install prompt (Chrome on Android)
  if (!showPrompt || !deferredPrompt) return null;

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
