import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface AIDecisionProps {
  recommendation: string;
  status: "APPROVED" | "PENDING" | "FLAGGED";
  fraudScore: number;
}

export default function AIDecision({ recommendation, status, fraudScore }: AIDecisionProps) {
  // Parse the recommendation text
  const sections = recommendation.split("\n\n").filter(s => s.trim());

  const getStatusConfig = () => {
    switch (status) {
      case "APPROVED":
        return {
          icon: CheckCircle2,
          title: "Claim Approved",
          color: "bg-emerald-500/10 border-emerald-500/20",
          textColor: "text-emerald-600 dark:text-emerald-400",
          badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
        };
      case "PENDING":
        return {
          icon: Clock,
          title: "Additional Verification Required",
          color: "bg-amber-500/10 border-amber-500/20",
          textColor: "text-amber-600 dark:text-amber-400",
          badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        };
      case "FLAGGED":
        return {
          icon: AlertTriangle,
          title: "Flagged for Investigation",
          color: "bg-red-500/10 border-red-500/20",
          textColor: "text-red-600 dark:text-red-400",
          badgeColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Parse key information from the text
  const lines = recommendation.split("\n");
  let fraudRiskLine = "";
  let claimAmountLine = "";
  const flaggedItems: string[] = [];
  const requiredActions: string[] = [];
  let estimatedResolution = "";
  let analysisText = "";
  let mandatoryActions: string[] = [];

  let currentSection = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes("Fraud Risk Score")) {
      fraudRiskLine = line;
    } else if (line.includes("Claim Amount")) {
      claimAmountLine = line;
    } else if (line === "**Analysis:**" || line === "**Critical Issues Detected:**") {
      currentSection = "analysis";
    } else if (line === "**Flagged Items:**" || line === "**Minor Observations:**") {
      currentSection = "flagged";
    } else if (line === "**Required Actions:**" || line === "**Mandatory Actions:**") {
      currentSection = "actions";
    } else if (line === "**Legal Notice:**") {
      currentSection = "legal";
    } else if (line.includes("**Estimated Resolution**")) {
      estimatedResolution = line.replace(/\*\*/g, "").replace("Estimated Resolution:", "").trim();
    } else if (line.startsWith("•")) {
      if (currentSection === "flagged") {
        flaggedItems.push(line.substring(1).trim());
      } else if (currentSection === "actions") {
        requiredActions.push(line.substring(1).trim());
      }
    } else if (line && !line.startsWith("**") && currentSection === "analysis") {
      analysisText += (analysisText ? " " : "") + line;
    }
  }

  // Extract claim amount from the line
  const claimMatch = claimAmountLine.match(/\$[\d,]+/);
  const claimAmount = claimMatch ? claimMatch[0] : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`rounded-xl border ${config.color} bg-card p-6 space-y-6`}
    >
      {/* Header with Status */}
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-3 ${config.badgeColor}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${config.textColor}`}>{config.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">AI-Powered Fraud Detection Analysis</p>
        </div>
      </div>

      {/* Risk Score and Claim Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-background/40 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Fraud Risk Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{fraudScore}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fraudScore >= 70
                  ? "bg-red-500"
                  : fraudScore >= 40
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${fraudScore}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg bg-background/40 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Claim Amount</p>
          <p className="text-2xl font-bold text-foreground">{claimAmount || "N/A"}</p>
        </div>
      </div>

      {/* Analysis */}
      {analysisText && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Analysis</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysisText}</p>
        </div>
      )}

      {/* Flagged Items / Minor Observations */}
      {flaggedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {status === "FLAGGED" ? "🚩 Critical Issues Detected" : "⚠️ Observations"}
          </p>
          <div className="space-y-2">
            {flaggedItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required/Mandatory Actions */}
      {requiredActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {status === "FLAGGED" ? "🔍 Mandatory Actions" : "✓ Required Actions"}
          </p>
          <div className="space-y-2">
            {requiredActions.map((action, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <span className={`font-bold mt-0.5 ${config.textColor}`}>→</span>
                <span className="text-foreground">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Resolution */}
      {estimatedResolution && (
        <div className="rounded-lg bg-background/40 p-4 border border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">⏱️ Estimated Resolution</p>
          <p className="text-sm font-medium text-foreground">{estimatedResolution}</p>
        </div>
      )}
    </motion.div>
  );
}
