import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'warm' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'xs';

const variants: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-primary-foreground shadow-warm-sm hover:bg-primary/90 hover:shadow-warm active:scale-[0.98]',
  secondary:
    'bg-secondary text-secondary-foreground shadow-warm-sm hover:bg-secondary/70 active:scale-[0.98]',
  ghost:
    'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
  destructive:
    'bg-destructive text-destructive-foreground shadow-warm-sm hover:bg-destructive/90 active:scale-[0.98]',
  outline:
    'border border-input bg-card text-foreground shadow-warm-sm hover:bg-accent hover:border-muted-foreground/40 active:scale-[0.98]',
  warm:
    'bg-cafe-foam text-cafe-green border border-cafe-mint hover:bg-cafe-mint/40 shadow-warm-sm active:scale-[0.98]',
  link:
    'text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none',
};

const sizes: Record<ButtonSize, string> = {
  xs:      'h-7 px-2.5 text-xs gap-1.5',
  sm:      'h-8 px-3.5 text-sm',
  default: 'h-10 px-5 text-sm',
  lg:      'h-11 px-7 text-base',
  icon:    'h-10 w-10 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium',
          'transition-all duration-200 ease-luxury',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
