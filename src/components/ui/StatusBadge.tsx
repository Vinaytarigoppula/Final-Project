import { cn } from "@/lib/utils";

type StatusType = "verified" | "warning" | "fraud" | "pending";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const statusStyles = {
  verified: "status-verified border",
  warning: "status-warning border",
  fraud: "status-fraud border",
  pending: "bg-muted/50 text-muted-foreground border border-border/50",
};

export function StatusBadge({ status, children, className, pulse }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        statusStyles[status],
        pulse && "pulse-ring",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "verified" && "bg-success",
          status === "warning" && "bg-warning",
          status === "fraud" && "bg-fraud",
          status === "pending" && "bg-muted-foreground"
        )}
      />
      {children}
    </span>
  );
}
