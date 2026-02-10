import React from 'react';
import { Loader2 } from 'lucide-react';
import { useRequestQueue } from '@/hooks/useRequestQueue';
import { cn } from '@/lib/utils';

interface LoadingQueueProps {
  className?: string;
}

/**
 * Component that shows request queue status
 *
 * Automatically appears when there are queued requests
 * Shows progress indicator and queue information
 */
export const LoadingQueue: React.FC<LoadingQueueProps> = ({ className }) => {
  const { queueLength, activeCount, isProcessing } = useRequestQueue();

  if (!isProcessing) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'bg-card shadow-lg rounded-lg',
        'border border-border dark:border-gray-700',
        'px-4 py-3',
        'flex items-center gap-3',
        'animate-in slide-in-from-bottom-4',
        className
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground dark:text-gray-100">
          กำลังประมวลผล...
        </span>
        <span className="text-xs text-muted-foreground dark:text-muted-foreground">
          {queueLength > 0
            ? `รอ ${queueLength} รายการ • กำลังทำ ${activeCount} รายการ`
            : `กำลังทำ ${activeCount} รายการ`}
        </span>
      </div>
    </div>
  );
};
