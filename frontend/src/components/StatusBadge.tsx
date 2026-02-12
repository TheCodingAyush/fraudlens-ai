import { ClaimStatus } from "@/types/claim";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ClaimStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalizedStatus = status?.toLowerCase();

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    approved: { bg: "bg-success/15", text: "text-success", label: "Approved" },
    pending: { bg: "bg-warning/15", text: "text-warning", label: "Pending" },
    flagged: { bg: "bg-flagged/15", text: "text-flagged", label: "Flagged" },
    rejected: { bg: "bg-destructive/15", text: "text-destructive", label: "Rejected" },
    pending_info: { bg: "bg-blue-500/15", text: "text-blue-500", label: "Info Requested" },
    manual_review: { bg: "bg-purple-500/15", text: "text-purple-500", label: "Manual Review" },
  };

  const config = statusConfig[normalizedStatus] || statusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.bg,
        config.text
      )}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
