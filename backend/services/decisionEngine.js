const decisionEngine = {
    makeDecision: (fraudAnalysis, claimAmount) => {
        const { fraudScore, riskLevel, indicators, recommendation } = fraudAnalysis;

        let status, explanation, confidence;

        // Decision logic based on fraud score and risk level
        if (fraudScore >= 70) {
            // HIGH RISK - Flag for manual review
            status = 'FLAGGED';
            confidence = 95;
            explanation = generateExplanation('flagged', fraudScore, indicators, claimAmount);

        } else if (fraudScore >= 40) {
            // MEDIUM RISK - Pending additional verification
            status = 'PENDING';
            confidence = 75;
            explanation = generateExplanation('pending', fraudScore, indicators, claimAmount);

        } else {
            // LOW RISK - Auto approve
            status = 'APPROVED';
            confidence = 90;
            explanation = generateExplanation('approved', fraudScore, indicators, claimAmount);
        }

        return {
            status,
            explanation,
            confidence,
            fraudScore,
            riskLevel,
            recommendation,
            processedAt: new Date().toISOString()
        };
    }
};

function generateExplanation(decision, fraudScore, indicators, claimAmount) {
    const explanations = {
        approved: [
            `✅ CLAIM APPROVED`,
            ``,
            `Fraud Risk Score: ${fraudScore}/100 (Low Risk)`,
            `Claim Amount: $${claimAmount.toLocaleString()}`,
            ``,
            `**Analysis:**`,
            `This claim has passed all automated fraud detection checks. The provided documentation appears authentic, and the claim details are consistent with standard insurance practices.`,
            ``,
            indicators.length > 0
                ? `**Minor Observations:**\n${indicators.map(ind => `• ${ind}`).join('\n')}\n\nThese factors are noted but do not indicate fraudulent activity.`
                : `No fraud indicators detected. All verification checks passed successfully.`,
            ``,
            `**Next Steps:**`,
            `• Payment will be processed within 2-3 business days`,
            `• Confirmation email sent to claimant`,
            `• Case closed automatically`
        ].join('\n'),

        pending: [
            `⏳ ADDITIONAL VERIFICATION REQUIRED`,
            ``,
            `Fraud Risk Score: ${fraudScore}/100 (Medium Risk)`,
            `Claim Amount: $${claimAmount.toLocaleString()}`,
            ``,
            `**Analysis:**`,
            `This claim requires additional verification before approval. While not indicative of fraud, certain factors warrant human review to ensure accuracy.`,
            ``,
            `**Flagged Items:**`,
            indicators.map(ind => `• ${ind}`).join('\n'),
            ``,
            `**Required Actions:**`,
            `• Claims adjuster will review within 24 hours`,
            `• May request additional documentation`,
            `• Claimant will be contacted if needed`,
            ``,
            `**Estimated Resolution:** 2-4 business days`
        ].join('\n'),

        flagged: [
            `🚨 CLAIM FLAGGED FOR FRAUD INVESTIGATION`,
            ``,
            `Fraud Risk Score: ${fraudScore}/100 (High Risk)`,
            `Claim Amount: $${claimAmount.toLocaleString()}`,
            ``,
            `**Critical Issues Detected:**`,
            indicators.map(ind => `• ${ind}`).join('\n'),
            ``,
            `**Analysis:**`,
            `This claim exhibits multiple red flags consistent with potentially fraudulent activity. Immediate manual investigation is required before any payment authorization.`,
            ``,
            `**Mandatory Actions:**`,
            `• Senior fraud investigator assigned`,
            `• Document forensic analysis initiated`,
            `• Claimant interview may be scheduled`,
            `• Third-party verification requested`,
            ``,
            `**Legal Notice:**`,
            `Fraudulent insurance claims are prosecuted under applicable laws. All claims are subject to thorough investigation.`,
            ``,
            `**Estimated Resolution:** 7-14 business days`
        ].join('\n')
    };

    return explanations[decision];
}

module.exports = decisionEngine;