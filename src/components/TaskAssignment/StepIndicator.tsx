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
                    ${isCompleted ? 'bg-green-600 text-white' : ''}
                    ${isCurrent ? 'bg-green-600 text-white ring-4 ring-green-200' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
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
                    ${isCurrent ? 'text-green-700' : 'text-gray-500'}
                  `}
                >
                  {stepLabels[index]}
                </div>
              </div>

              {/* Connector Line */}
              {index < totalSteps - 1 && (
                <div
                  className={`
                    flex-1 h-1 mx-2
                    ${stepNumber < currentStep ? 'bg-green-600' : 'bg-gray-200'}
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
