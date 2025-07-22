
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-apple",
  {
    variants: {
      variant: {
        default: "bg-gradient-apple text-white shadow-apple hover:shadow-apple-lg hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-apple hover:bg-destructive/90 hover:shadow-apple-lg hover:scale-[1.02] active:scale-[0.98]",
        outline: "border-2 border-primary/20 glass-card text-primary hover:bg-primary/5 hover:border-primary/30 hover:shadow-glass hover:scale-[1.02] active:scale-[0.98]",
        secondary: "glass-card text-foreground hover:bg-muted/10 hover:shadow-glass hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-primary/5 hover:text-primary text-foreground hover:scale-[1.02] active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-dark",
        glass: "glass text-foreground hover:bg-glass-white-80/50 hover:shadow-glass hover:scale-[1.02] active:scale-[0.98]"
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base font-semibold",
        icon: "h-11 w-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
