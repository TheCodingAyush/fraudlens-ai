export type ClaimType = "Auto" | "Home" | "Health" | "Life" | "Travel" | "Property";
export type ClaimStatus = "Approved" | "Pending" | "Flagged" | "approved" | "rejected" | "pending_info" | "manual_review";

export interface AiAnalysis {
  summary: string;
  riskFactors: string[];
  recommendation: string;
  confidence: number;
}

export interface ClaimFiles {
  policyDocument?: string;
  damagePhotos?: string[];
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
  files?: ClaimFiles;
  // Admin review fields
  reviewedAt?: string;
  reviewerName?: string;
  reviewNotes?: string;
  approvedAmount?: number;
  rejectionReason?: string;
  infoRequestMessage?: string;
  requestedDocuments?: string[];
  escalationReason?: string;
  escalationPriority?: "low" | "medium" | "high";
}
