import { useEffect, useRef, useCallback } from 'react';

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const Turnstile = ({ siteKey, onToken, onExpire }: TurnstileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token: string) => onTokenRef.current(token),
      'expired-callback': () => onExpireRef.current?.(),
      'error-callback': () => onExpireRef.current?.(),
    });
  }, [siteKey]);

  useEffect(() => {
    // If turnstile already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load script
    const existing = document.querySelector('script[src*="turnstile"]');
    if (!existing) {
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      document.head.appendChild(script);
    } else {
      // Script exists but not loaded yet
      window.onTurnstileLoad = renderWidget;
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  return <div ref={containerRef} />;
};

export default Turnstile;
