import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepLabels
}) => {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <React.Fragment key={stepNumber}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    ${isCompleted ? 'bg-pink-500 text-white' : ''}
                    ${isCurrent ? 'bg-pink-500 text-white ring-4 ring-pink-200 dark:ring-pink-800' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-muted dark:bg-background/80 text-muted-foreground' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <div
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCurrent ? 'text-pink-600 dark:text-pink-400' : 'text-muted-foreground'}
                  `}
                >
                  {stepLabels[index]}
                </div>
              </div>

              {/* Connector Line */}
              {index < totalSteps - 1 && (
                <div
                  className={`
                    flex-1 h-1 mx-2 mb-7
                    ${stepNumber < currentStep ? 'bg-pink-500' : 'bg-muted'}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
