export type ClaimType = "Auto" | "Home" | "Health";
export type ClaimStatus = "Approved" | "Pending" | "Flagged";

export interface AiAnalysis {
  summary: string;
  riskFactors: string[];
  recommendation: string;
  confidence: number;
}

export interface Claim {
  id: string;
  policyNumber: string;
  claimantName: string;
  claimantEmail: string;
  claimType: ClaimType;
  incidentDate: string;
  claimAmount: number;
  description: string;
  status: ClaimStatus;
  fraudScore: number;
  submittedAt: string;
  aiAnalysis: AiAnalysis;
}
