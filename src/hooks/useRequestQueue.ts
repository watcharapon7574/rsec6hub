import { useState, useEffect } from 'react';
import { requestQueue } from '@/utils/requestQueue';

/**
 * Hook for monitoring RequestQueue status
 *
 * Usage:
 * ```typescript
 * const { queueLength, activeCount, isProcessing } = useRequestQueue();
 *
 * // Show loading indicator when queue is processing
 * {isProcessing && <LoadingSpinner text={`Processing ${queueLength} requests...`} />}
 * ```
 */
export const useRequestQueue = () => {
  const [status, setStatus] = useState({
    queueLength: 0,
    activeCount: 0,
    maxConcurrent: 0,
  });

  useEffect(() => {
    // Poll queue status every 500ms
    const interval = setInterval(() => {
      const currentStatus = requestQueue.getStatus();
      setStatus(currentStatus);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const isProcessing = status.queueLength > 0 || status.activeCount > 0;

  return {
    ...status,
    isProcessing,
    // Calculate progress percentage (0-100)
    progressPercentage: isProcessing ? Math.round((status.activeCount / status.maxConcurrent) * 100) : 0,
  };
};
