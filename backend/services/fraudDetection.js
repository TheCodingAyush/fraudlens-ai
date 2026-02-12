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

        // Rule 6: Suspicious keywords in description
        const suspiciousKeywords = ['total loss', 'completely destroyed', 'stolen', 'fire', 'flood'];
        const descLower = claimData.description?.toLowerCase() || '';
        const foundKeywords = suspiciousKeywords.filter(keyword => descLower.includes(keyword));

        if (foundKeywords.length >= 2) {
            indicators.push(`Multiple high-risk keywords: ${foundKeywords.join(', ')}`);
            fraudScore += 15;
        }

        // ============== DOCUMENT VALIDATION ANALYSIS ==============
        // Use results from document validation service (OCR vs form data comparison)
        let documentValidationScore = 0;

        if (claimData.documentValidation) {
            const docVal = claimData.documentValidation;

            // Add all indicators from document validation
            if (docVal.indicators && docVal.indicators.length > 0) {
                indicators.push(...docVal.indicators);
            }

            // Add document validation fraud score
            documentValidationScore = docVal.fraudScore || 0;

            // Log validation summary
            if (docVal.details) {
                const details = docVal.details;

                // Policy number validation status
                if (details.policyNumber?.status === 'match') {
                    // Good - policy number matches, no penalty
                } else if (details.policyNumber?.status === 'mismatch') {
                    // Already counted in docVal.fraudScore
                    console.log('Document validation: Policy number mismatch detected');
                } else if (details.policyNumber?.status === 'not_found') {
                    console.log('Document validation: No policy number found in document');
                }

                // Name validation status
                if (details.claimantName?.status === 'mismatch') {
                    console.log(`Document validation: Name mismatch - similarity ${Math.round((details.claimantName.similarity || 0) * 100)}%`);
                }

                // Coverage validation
                if (details.coverageAmount?.exceeds) {
                    console.log('Document validation: Claim exceeds coverage');
                }
            }
        } else if (claimData.extractedData && !claimData.extractedData.error) {
            // Fallback: Use legacy OCR validation if document validation wasn't run
            // Rule 6 (legacy): Policy number mismatch
            if (claimData.extractedData?.policyNumber &&
                claimData.extractedData.policyNumber !== claimData.policyNumber) {
                indicators.push('Policy number mismatch with document');
                fraudScore += 30;
            }

            // Rule 7 (legacy): Excessive claim vs coverage
            if (claimData.extractedData?.coverageAmount) {
                const coverage = parseInt(claimData.extractedData.coverageAmount);
                if (claimData.claimAmount > coverage * 0.9) {
                    indicators.push('Claim near or exceeds coverage limit');
                    fraudScore += 20;
                }
            }
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

            } catch (error) {
                console.error('Image analysis failed:', error);
                indicators.push('Image analysis failed - manual review recommended');
            }
        } else {
            // No images provided
            indicators.push('No damage photos provided for verification');
        }

        // ============== COMBINE SCORES ==============
        // Weight different analysis components
        const textWeight = 0.35;      // 35% text/behavioral analysis
        const docValWeight = 0.35;    // 35% document validation (OCR vs form)
        const imageWeight = 0.30;     // 30% image analysis

        const textScore = Math.min(fraudScore, 100);
        const imageScore = imageAnalysisResults?.combinedFraudScore || 0;

        // Calculate weighted combined score
        let combinedScore;
        if (imageAnalysisResults && claimData.documentValidation) {
            // All three components available
            combinedScore = Math.round(
                (textScore * textWeight) +
                (documentValidationScore * docValWeight) +
                (imageScore * imageWeight)
            );
        } else if (claimData.documentValidation) {
            // Text + document validation only
            combinedScore = Math.round(
                (textScore * 0.5) +
                (documentValidationScore * 0.5)
            );
        } else if (imageAnalysisResults) {
            // Text + image only
            combinedScore = Math.round(
                (textScore * 0.6) +
                (imageScore * 0.4)
            );
        } else {
            // Text only
            combinedScore = textScore;
        }

        // Ensure score is in valid range
        combinedScore = Math.max(0, Math.min(100, combinedScore));

        return {
            fraudScore: combinedScore,
            indicators,
            riskLevel: getFraudRiskLevel(combinedScore),
            recommendation: getRecommendation(combinedScore),
            imageAnalysis: imageAnalysisResults,
            documentValidation: claimData.documentValidation ? {
                score: documentValidationScore,
                isValid: claimData.documentValidation.isValid
            } : null,
            breakdown: {
                textAnalysisScore: textScore,
                documentValidationScore,
                imageAnalysisScore: imageScore,
                weights: { text: textWeight, docVal: docValWeight, image: imageWeight }
            }
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