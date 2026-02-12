import type { Claim, ClaimType } from "@/types/claim";

const API_BASE_URL = "http://localhost:5000/api";

export interface SubmitClaimData {
    policyNumber: string;
    claimantName: string;
    claimantEmail: string;
    claimType: ClaimType | "";
    incidentDate: string;
    claimAmount: string;
    description: string;
}

export interface SubmitClaimResponse {
    success: boolean;
    message: string;
    claim: Claim;
}

export async function submitClaim(
    formData: SubmitClaimData,
    policyDocument: File | null,
    damagePhotos: File[]
): Promise<SubmitClaimResponse> {
    const data = new FormData();

    // Add form fields
    data.append("policyNumber", formData.policyNumber);
    data.append("claimantName", formData.claimantName);
    data.append("claimantEmail", formData.claimantEmail);
    data.append("claimType", formData.claimType);
    data.append("incidentDate", formData.incidentDate);
    data.append("claimAmount", formData.claimAmount);
    data.append("description", formData.description);

    // Add policy document
    if (policyDocument) {
        data.append("policyDocument", policyDocument);
    }

    // Add damage photos
    damagePhotos.forEach((photo) => {
        data.append("damagePhotos", photo);
    });

    const response = await fetch(`${API_BASE_URL}/claims/submit`, {
        method: "POST",
        body: data,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Submission failed" }));
        throw new Error(error.message || "Failed to submit claim");
    }

    return response.json();
}

export async function fetchClaims(): Promise<Claim[]> {
    const response = await fetch(`${API_BASE_URL}/claims`);

    if (!response.ok) {
        throw new Error("Failed to fetch claims");
    }

    const data = await response.json();
    return data.claims || data;
}

export async function fetchClaimById(id: string): Promise<Claim> {
    const response = await fetch(`${API_BASE_URL}/claims/${id}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Claim not found");
        }
        throw new Error("Failed to fetch claim details");
    }

    const data = await response.json();
    return data.claim || data;
}
