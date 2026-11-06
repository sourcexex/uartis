import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-radius-md)] text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--app-motion-fast)] ease-[var(--app-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-main)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--app-accent)] text-[var(--app-on-accent)] shadow-sm hover:bg-[var(--app-accent-hover)] active:scale-[0.98]',
        destructive:
          'bg-[var(--app-danger)] text-[var(--app-on-accent)] shadow-sm hover:brightness-110 active:scale-[0.98]',
        outline:
          'border border-[var(--app-border)] bg-transparent text-[var(--app-text-primary)] shadow-sm hover:border-[var(--app-border-dark)] hover:bg-[var(--app-bg-hover)] active:scale-[0.98]',
        secondary:
          'bg-[var(--app-button-secondary-bg)] text-[var(--app-text-primary)] shadow-sm hover:bg-[var(--app-button-secondary-hover)] active:scale-[0.98]',
        ghost:
          'text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] hover:text-[var(--app-text-primary)]',
        link: 'text-[var(--app-accent)] underline-offset-4 hover:underline',
        success:
          'bg-[var(--app-success)] text-[var(--app-on-accent)] shadow-sm hover:brightness-110 active:scale-[0.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-[var(--app-radius-sm)] px-3 text-xs',
        lg: 'h-10 rounded-[var(--app-radius-md)] px-8',
        icon: 'h-9 w-9',
        xs: 'h-7 rounded-[var(--app-radius-sm)] px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
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
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
