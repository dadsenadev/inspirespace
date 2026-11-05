import * as React from "react";
import { cn } from "@/lib/utils";

export interface TrustBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "emerald" | "slate" | "amber";
}

export function TrustBadge({
  className,
  variant = "emerald",
  children,
  ...props
}: TrustBadgeProps) {
  const styles = {
    emerald:
      "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
    slate:
      "bg-[#FAFAFA] text-[#0F172A] border-[#E2E8F0]",
    amber:
      "bg-amber-50 text-amber-800 border-amber-200",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium tracking-tight",
        styles,
        className
      )}
      {...props}
    >
      {variant === "emerald" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

