import { ClaimStatus } from "@/types/claim";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ClaimStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "Approved" && "bg-success/15 text-success",
        status === "Pending" && "bg-warning/15 text-warning",
        status === "Flagged" && "bg-flagged/15 text-flagged"
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
