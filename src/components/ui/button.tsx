import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { GLASS_SUBTLE, GLASS_SUBTLE_HOVER_BG } from "@/lib/glass";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "border border-erro-accent/30 bg-erro-bg text-erro-fg shadow-sm hover:bg-erro-bg/70",
        // bg-card (não bg-background): border-input é derivado pra contrastar ≥3:1 contra
        // --surface (=--card), não contra --page-bg — onda 3 PARTE 6 encontrou isso no Noir
        // (borda quase invisível, 1.92:1) porque page-bg é mais escuro que a superfície ali.
        outline:
          "border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: `${GLASS_SUBTLE} text-foreground shadow-sm ${GLASS_SUBTLE_HOVER_BG}`,
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // text-foreground (não text-primary): --primary é fixo (near-black) em qualquer tema —
        // onda 3 PARTE 6 encontrou isso no Noir ("Preencher agora" quase invisível, 1.02:1, contra
        // superfície escura). --text (=foreground) já é theme-aware e verificado ≥4.5:1 em todo
        // tema (mesmo raciocínio do fix do Checkbox: reaproveita token já garantido).
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
