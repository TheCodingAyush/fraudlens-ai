const imageAnalysis = require('./imageAnalysis');

const fraudDetection = {
    analyzeClaim: async (claimData, imageBuffers = []) => {
        const indicators = [];
        let fraudScore = 0;

        // ============== TEXT/DATA ANALYSIS ==============

        // Rule 1: Unusually high claim amount
        if (claimData.claimAmount > 50000) {
            indicators.push('High claim amount detected');
            fraudScore += 25;
        }

        // Rule 2: Recent incident (same day submission - suspicious)
        const incidentDate = new Date(claimData.incidentDate);
        const today = new Date();
        const daysDiff = Math.floor((today - incidentDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            indicators.push('Claim submitted on same day as incident');
            fraudScore += 20;
        }

        // Rule 3: Vague description
        if (claimData.description && claimData.description.length < 50) {
            indicators.push('Insufficient incident description');
            fraudScore += 15;
        }

        // Rule 4: Weekend/Holiday incident (statistically higher fraud)
        const dayOfWeek = incidentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            indicators.push('Incident occurred on weekend');
            fraudScore += 10;
        }

        // Rule 5: Round numbers (psychological indicator)
        if (claimData.claimAmount % 1000 === 0) {
            indicators.push('Claim amount is a round number');
            fraudScore += 10;
        }

        // Rule 6: Policy number mismatch (if OCR extracted one)
        if (claimData.extractedData?.policyNumber &&
            claimData.extractedData.policyNumber !== claimData.policyNumber) {
            indicators.push('Policy number mismatch with document');
            fraudScore += 30;
        }

        // Rule 7: Excessive claim vs coverage
        if (claimData.extractedData?.coverageAmount) {
            const coverage = parseInt(claimData.extractedData.coverageAmount);
            if (claimData.claimAmount > coverage * 0.9) {
                indicators.push('Claim near or exceeds coverage limit');
                fraudScore += 20;
            }
        }

        // Rule 8: Suspicious keywords in description
        const suspiciousKeywords = ['total loss', 'completely destroyed', 'stolen', 'fire', 'flood'];
        const descLower = claimData.description?.toLowerCase() || '';
        const foundKeywords = suspiciousKeywords.filter(keyword => descLower.includes(keyword));

        if (foundKeywords.length >= 2) {
            indicators.push(`Multiple high-risk keywords: ${foundKeywords.join(', ')}`);
            fraudScore += 15;
        }

        // ============== IMAGE ANALYSIS ==============
        let imageAnalysisResults = null;

        if (imageBuffers && imageBuffers.length > 0) {
            try {
                imageAnalysisResults = await imageAnalysis.analyzeMultipleImages(imageBuffers, {
                    claimType: claimData.claimType,
                    incidentDate: claimData.incidentDate,
                    policyNumber: claimData.policyNumber
                });

                // Add image-based indicators
                indicators.push(...imageAnalysisResults.combinedIndicators);

                // Weight image fraud score (images are strong evidence)
                const imageWeight = 0.4; // 40% weight to image analysis
                const textWeight = 0.6;  // 60% weight to text analysis

                // Combine scores
                const combinedTextScore = Math.min(fraudScore, 100);
                fraudScore = Math.round(
                    (combinedTextScore * textWeight) +
                    (imageAnalysisResults.combinedFraudScore * imageWeight)
                );

            } catch (error) {
                console.error('Image analysis failed:', error);
                indicators.push('Image analysis failed - manual review recommended');
                fraudScore += 10;
            }
        } else {
            // No images provided
            indicators.push('No damage photos provided for verification');
            fraudScore += 15;
        }

        // Normalize fraud score (0-100)
        fraudScore = Math.min(fraudScore, 100);

        return {
            fraudScore,
            indicators,
            riskLevel: getFraudRiskLevel(fraudScore),
            recommendation: getRecommendation(fraudScore),
            imageAnalysis: imageAnalysisResults
        };
    }
};

function getFraudRiskLevel(score) {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
}

function getRecommendation(score) {
    if (score >= 70) return 'MANUAL_REVIEW_REQUIRED';
    if (score >= 40) return 'ADDITIONAL_VERIFICATION';
    return 'AUTO_APPROVE';
}

module.exports = fraudDetection;