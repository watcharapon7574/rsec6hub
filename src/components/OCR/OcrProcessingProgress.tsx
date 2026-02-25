import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, ScanText, Brain, Layers, CheckCircle2, XCircle } from 'lucide-react';
import type { OcrProcessingState } from '@/types/ocr';

interface OcrProcessingProgressProps {
  state: OcrProcessingState;
}

const steps = [
  { key: 'uploading', label: 'อัปโหลด', icon: Upload },
  { key: 'ocr', label: 'OCR', icon: ScanText },
  { key: 'chunking', label: 'แบ่ง Chunk', icon: Layers },
  { key: 'embedding', label: 'Embedding', icon: Brain },
  { key: 'saving', label: 'บันทึก', icon: CheckCircle2 },
] as const;

const stepOrder = ['uploading', 'ocr', 'chunking', 'embedding', 'saving', 'done'] as const;

const OcrProcessingProgress = ({ state }: OcrProcessingProgressProps) => {
  const currentIndex = stepOrder.indexOf(state.step as any);
  const isError = state.step === 'error';
  const isDone = state.step === 'done';

  const progressPercent = isDone ? 100 : isError ? 0 : ((currentIndex + 0.5) / steps.length) * 100;

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3 mb-3">
          {isError ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : isDone ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          )}
          <span className="text-sm font-medium">{state.message}</span>
        </div>

        <Progress value={progressPercent} className="h-2 mb-3" />

        <div className="flex justify-between">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.key === state.step;
            const isCompleted = currentIndex > i || isDone;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <Icon
                  className={`h-4 w-4 ${
                    isCompleted
                      ? 'text-green-500'
                      : isActive
                      ? 'text-blue-500'
                      : 'text-muted-foreground/40'
                  }`}
                />
                <span
                  className={`text-xs ${
                    isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : isActive
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-muted-foreground/40'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {(state.step === 'ocr' || state.step === 'chunking') && state.totalPages && state.totalPages > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {state.step === 'ocr' ? 'หน้า' : 'Chunk'} {state.currentPage}/{state.totalPages}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OcrProcessingProgress;
