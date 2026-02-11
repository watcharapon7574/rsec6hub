import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

// AnimatedProgress - progress bar ที่แสดง animation แบบสมจริง
interface AnimatedProgressProps {
  className?: string;
  duration?: number; // ระยะเวลา animation (ms) default 8000
}

const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  className,
  duration = 8000
}) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    // Reset progress เมื่อ component mount
    setProgress(0);

    // Animate progress แบบ easing (เริ่มเร็ว แล้วช้าลง)
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = elapsed / duration;

      // ใช้ easing function แบบ ease-out (เริ่มเร็ว ช้าลงตอนท้าย)
      // จำกัดไว้ที่ 95% เพื่อให้ดูเหมือนยังโหลดอยู่
      const easedProgress = Math.min(95, rawProgress < 1
        ? (1 - Math.pow(1 - rawProgress, 3)) * 95
        : 95);

      setProgress(easedProgress);

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      }
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [duration]);

  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all duration-100"
        style={{ transform: `translateX(-${100 - progress}%)` }}
      />
    </ProgressPrimitive.Root>
  );
};

export { Progress, AnimatedProgress }
