// src/components/ui/index.tsx
// A collection of lightweight, consistent UI primitives

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ── Button ────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none';
    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
      secondary: 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-sm',
      outline: 'border border-border bg-background hover:bg-muted text-foreground',
      ghost: 'hover:bg-muted text-foreground',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    };
    const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-11 px-6 text-base' };
    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ── Card ─────────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('bg-card border border-border rounded-xl shadow-sm', className)}>{children}</div>
);
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-6 py-4 border-b border-border', className)}>{children}</div>
);
export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-6 py-4', className)}>{children}</div>
);
export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-6 py-4 border-t border-border', className)}>{children}</div>
);

// ── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input
          ref={ref}
          className={cn(
            'w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all',
            Boolean(icon) && 'pl-9',
            error && 'border-destructive focus:ring-destructive',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// ── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all',
          error && 'border-destructive',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <svg className={cn('animate-spin text-current', sizes[size], className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ── Avatar ────────────────────────────────────────────────────────────────────
export const Avatar: React.FC<{ name: string; src?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ name, src, size = 'md', className }) => {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg' };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={cn('rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold overflow-hidden shrink-0', sizes[size], className)}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
    </div>
  );
};

// ── StatusBadge ───────────────────────────────────────────────────────────────
const statusMap = {
  acquired: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'in-progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  gap: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Beginner: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Intermediate: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Advanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  common: 'bg-slate-100 text-slate-700',
  rare: 'bg-blue-100 text-blue-800',
  epic: 'bg-purple-100 text-purple-800',
  legendary: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-800',
  graded: 'bg-emerald-100 text-emerald-800',
  returned: 'bg-orange-100 text-orange-800',
  growing: 'bg-emerald-100 text-emerald-800',
  stable: 'bg-blue-100 text-blue-800',
  declining: 'bg-red-100 text-red-800',
  high: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

export const StatusBadge: React.FC<{ status: keyof typeof statusMap | string; className?: string }> = ({ status, className }) => (
  <span className={cn('badge-pill', statusMap[status as keyof typeof statusMap] || 'bg-muted text-muted-foreground', className)}>
    {status}
  </span>
);

// ── Progress Bar ──────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{ value: number; max?: number; className?: string; color?: string }> = ({
  value, max = 100, className, color = 'bg-amber-500'
}) => (
  <div className={cn('h-2 w-full bg-muted rounded-full overflow-hidden', className)}>
    <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="mb-4 text-muted-foreground/40">{icon}</div>}
    <h3 className="font-serif text-lg font-normal text-foreground">{title}</h3>
    {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

// ── Alert ─────────────────────────────────────────────────────────────────────
export const Alert: React.FC<{ variant?: 'error' | 'success' | 'warning' | 'info'; children: React.ReactNode; className?: string }> = ({ variant = 'info', children, className }) => {
  const variants = {
    error: 'bg-destructive/10 text-destructive border-destructive/30',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', variants[variant], className)}>
      {children}
    </div>
  );
};

// ── Toast (simple) ────────────────────────────────────────────────────────────
let _toastFn: ((msg: string, type?: 'success' | 'error' | 'info') => void) | null = null;
export const registerToast = (fn: typeof _toastFn) => { _toastFn = fn; };
export const toast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => _toastFn?.(msg, type);

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  useEffect(() => {
    registerToast((msg, type = 'info') => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    });
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          'animate-fade-in rounded-lg border px-4 py-3 text-sm font-medium shadow-lg',
          t.type === 'success' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
          t.type === 'error' && 'bg-red-50 text-red-800 border-red-200',
          t.type === 'info' && 'bg-card text-foreground border-border'
        )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
};

// We need useState and useEffect for ToastContainer
import { useState, useEffect } from 'react';
