import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95 active:shadow-clay-inset touch-target",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-clay-primary hover:-translate-y-0.5 hover:shadow-clay-lg",
        destructive: "bg-destructive text-destructive-foreground shadow-clay-primary hover:-translate-y-0.5 hover:shadow-clay-lg",
        outline: "bg-card text-foreground shadow-clay hover:-translate-y-0.5 hover:shadow-clay-lg",
        secondary: "bg-secondary text-secondary-foreground shadow-clay-secondary hover:-translate-y-0.5 hover:shadow-clay-lg",
        ghost: "hover:bg-accent/40 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
        uds: "bg-gradient-uds text-white shadow-clay-primary hover:-translate-y-0.5 hover:shadow-clay-lg",
        purple: "bg-uds-purple text-white shadow-clay-primary hover:-translate-y-0.5 hover:shadow-clay-lg",
        orange: "bg-uds-orange text-white shadow-clay-secondary hover:-translate-y-0.5 hover:shadow-clay-lg",
        success: "bg-success text-success-foreground shadow-clay-primary hover:-translate-y-0.5 hover:shadow-clay-lg",
      },
      size: {
        default: "h-11 px-6 py-2.5 text-sm",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
