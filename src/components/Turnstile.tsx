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
      'error-callback': () => {
        // On error, provide a fallback token so search still works
        // Server-side rate limiting still protects against abuse
        console.warn('Turnstile failed to load, using fallback');
        onTokenRef.current('__turnstile_failed__');
      },
    });
  }, [siteKey]);

  useEffect(() => {
    // If turnstile already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load script with timeout fallback
    const existing = document.querySelector('script[src*="turnstile"]');
    if (!existing) {
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.onerror = () => {
        console.warn('Turnstile script failed to load');
        onTokenRef.current('__turnstile_failed__');
      };
      document.head.appendChild(script);
    } else {
      window.onTurnstileLoad = renderWidget;
    }

    // Fallback: if Turnstile doesn't load within 5 seconds, allow search anyway
    const timeout = setTimeout(() => {
      if (!widgetIdRef.current) {
        console.warn('Turnstile timeout, using fallback');
        onTokenRef.current('__turnstile_failed__');
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  return <div ref={containerRef} />;
};

export default Turnstile;
