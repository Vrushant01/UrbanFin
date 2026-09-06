import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-600 shadow-sm border border-transparent transition-all duration-150 active:translate-y-[1px]",
      secondary: "bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200 border border-slate-200 shadow-sm transition-all duration-150 active:translate-y-[1px]",
      outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700 focus:ring-slate-200 transition-all duration-150 active:translate-y-[1px]",
      ghost: "bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-200 transition-all duration-150 active:translate-y-[1px]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
