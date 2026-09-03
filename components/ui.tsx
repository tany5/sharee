import Link from "next/link";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Star } from "lucide-react";
import { cx } from "@/lib/utils";

/* ------------------------------- Button ------------------------------- */

export type ButtonVariant = "primary" | "outline" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-btn text-btntext hover:opacity-90 shadow-sm border border-transparent",
  outline:
    "bg-transparent text-ink border border-accent/60 hover:bg-accent/10",
  ghost: "bg-transparent text-ink hover:bg-accent/10",
  soft: "bg-accent/15 text-ink hover:bg-accent/25 border border-accent/20",
};

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function btnStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(
    "inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition-colors select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    extra,
  );
}

interface ButtonLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={btnStyles(variant, size, className)} {...props} />;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={btnStyles(variant, size, className)}
      {...props}
    />
  );
}

/* ------------------------------- Stars ------------------------------- */

export function Stars({
  rating,
  className,
  size = 14,
}: {
  rating: number;
  className?: string;
  size?: number;
}) {
  const rounded = Math.round(rating);
  return (
    <span
      className={cx("inline-flex items-center gap-0.5 text-bronze", className)}
      role="img"
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rounded ? "fill-current" : "opacity-30"}
        />
      ))}
    </span>
  );
}

/* --------------------------- Section chrome --------------------------- */

export function SectionHeading({
  title,
  kicker,
  action,
  center,
  className,
}: {
  title: string;
  kicker?: string;
  action?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mb-6 flex flex-col gap-1 sm:mb-8",
        center && "items-center text-center",
        className,
      )}
    >
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {kicker}
        </p>
      )}
      <div className={cx("flex w-full items-end gap-4", center && "flex-col items-center")}>
        <h2 className="text-2xl text-ink sm:text-[2rem]">{title}</h2>
        {action && <div className="ml-auto shrink-0 pb-1">{action}</div>}
      </div>
    </div>
  );
}

export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-3", className)} aria-hidden>
      <span className="h-px w-10 bg-line sm:w-16" />
      <span className="h-1.5 w-1.5 rotate-45 border border-bronze bg-bronze/60" />
      <span className="h-px w-10 bg-line sm:w-16" />
    </div>
  );
}

/* ------------------------------ Form bits ----------------------------- */

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
        {hint && <span className="ml-auto text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputBase, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, "min-h-24 py-2.5", className)} {...props} />;
}

export function SelectInput({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/* ----------------------------- Empty state ---------------------------- */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
      {icon && <div className="text-accent/70">{icon}</div>}
      <h2 className="text-xl text-ink">{title}</h2>
      <p className="max-w-sm text-[15px] leading-6 text-ink2">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
