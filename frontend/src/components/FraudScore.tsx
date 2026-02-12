import { cn } from "@/lib/utils";

interface FraudScoreProps {
  score: number;
  size?: "sm" | "lg";
}

const FraudScore = ({ score, size = "sm" }: FraudScoreProps) => {
  const getColor = () => {
    if (score <= 20) return "text-success";
    if (score <= 50) return "text-warning";
    return "text-flagged";
  };

  const getLabel = () => {
    if (score <= 20) return "Low Risk";
    if (score <= 50) return "Medium Risk";
    return "High Risk";
  };

  const getBgColor = () => {
    if (score <= 20) return "bg-success/10";
    if (score <= 50) return "bg-warning/10";
    return "bg-flagged/10";
  };

  if (size === "lg") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={cn("flex h-20 w-20 items-center justify-center rounded-full", getBgColor())}>
          <span className={cn("text-2xl font-bold font-mono", getColor())}>{score}</span>
        </div>
        <span className={cn("text-sm font-medium", getColor())}>{getLabel()}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm font-bold font-mono", getColor())}>{score}</span>
      <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", score <= 20 ? "bg-success" : score <= 50 ? "bg-warning" : "bg-flagged")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

export default FraudScore;
