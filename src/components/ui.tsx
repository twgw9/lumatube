import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ── Button ──────────────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-black hover:brightness-110 active:brightness-95 font-semibold",
  secondary:
    "bg-[var(--bg-elev-2)] text-[var(--text)] hover:bg-[color-mix(in_oklab,var(--text)_10%,var(--bg-elev-2))] border border-[var(--border)]",
  ghost: "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elev-2)]",
  danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30",
  outline: "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-elev-2)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9.5 w-9.5 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

export function Button({ variant = "secondary", size = "md", active, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap transition-[background,color,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        active && "bg-accent-soft text-[var(--accent)] ring-1 ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]",
        className,
      )}
    />
  );
}

/* ── IconButton with tooltip ─────────────────────────────────── */
export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "group relative grid place-items-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)] active:scale-95 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Input ───────────────────────────────────────────────────── */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cn(
          "h-9.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 text-sm outline-none transition placeholder:text-[var(--text-mute)] focus:border-[color-mix(in_oklab,var(--accent)_50%,var(--border))]",
          className,
        )}
      />
    );
  },
);

/* ── Switch ──────────────────────────────────────────────────── */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  const control = (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40",
        checked
          ? "border-transparent bg-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--bg-elev-2)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full transition-transform duration-200",
          checked ? "translate-x-[18px] bg-black/80" : "translate-x-0.5 bg-[var(--text-dim)]",
        )}
      />
    </button>
  );

  if (!label) return control;
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-mute)]">
            {description}
          </span>
        )}
      </span>
      {control}
    </label>
  );
}

/* ── Select ──────────────────────────────────────────────────── */
export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9.5 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 pr-8 text-sm outline-none focus:border-[color-mix(in_oklab,var(--accent)_50%,var(--border))]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--bg-elev)]">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-mute)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── Segmented control ───────────────────────────────────────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-elev-2)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[10px] px-3 font-medium transition-colors",
            size === "sm" ? "h-7 text-[12px]" : "h-8 text-[13px]",
            value === o.value
              ? "bg-[var(--bg-elev)] text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--text-mute)] hover:text-[var(--text)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Settings row/section ────────────────────────────────────── */
export function SettingsSection({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <header className="mb-3 flex items-center gap-2.5">
        {icon && <span className="text-[var(--accent)]">{icon}</span>}
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[12.5px] text-[var(--text-mute)]">{description}</p>
          )}
        </div>
      </header>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="divide-y divide-[var(--border)] px-4">{children}</div>
      </div>
    </section>
  );
}

/* ── Row ─────────────────────────────────────────────────────── */
export function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-mute)]">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Tooltip-free badge ──────────────────────────────────────── */
export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "live" | "warn" | "success";
  className?: string;
}) {
  const tones = {
    default: "bg-[var(--bg-elev-2)] text-[var(--text-dim)] border-[var(--border)]",
    accent: "bg-accent-soft text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_30%,transparent)]",
    live: "bg-rose-500 text-white border-transparent",
    warn: "bg-amber-400/15 text-amber-300 border-amber-400/25",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Empty state ─────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center anim-fade">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-mute)]">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--text-mute)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Skeleton card ───────────────────────────────────────────── */
export function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div className={cn("anim-fade", wide ? "flex gap-3" : "")}>
      <div className={cn("skeleton rounded-xl", wide ? "aspect-video w-44 shrink-0" : "aspect-video w-full")} />
      <div className={cn("flex-1 space-y-2", wide ? "pt-1" : "pt-3")}>
        <div className="skeleton h-3.5 w-11/12 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}
