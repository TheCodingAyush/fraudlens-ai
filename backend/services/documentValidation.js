/**
 * Document Validation Service
 * Validates extracted OCR data against form submission data
 */

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, where 1 is exact match)
 */
function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= s1.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return 1 - (matrix[s1.length][s2.length] / maxLen);
}

/**
 * Normalize policy number for comparison (remove spaces, dashes, convert to uppercase)
 * @param {string} policyNumber - Raw policy number
 * @returns {string} Normalized policy number
 */
function normalizePolicyNumber(policyNumber) {
    if (!policyNumber) return '';
    return policyNumber.toString().replace(/[\s\-_.]/g, '').toUpperCase();
}

/**
 * Normalize name for comparison (handle common variations)
 * @param {string} name - Raw name
 * @returns {string} Normalized name
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')           // Multiple spaces to single
        .replace(/[.,]/g, '')            // Remove punctuation
        .replace(/\bjr\.?$/i, '')        // Remove Jr suffix
        .replace(/\bsr\.?$/i, '')        // Remove Sr suffix
        .replace(/\biii?$/i, '')         // Remove II, III suffix
        .trim();
}

/**
 * Parse currency amount from string
 * @param {string|number} amount - Amount string or number
 * @returns {number} Parsed amount
 */
function parseAmount(amount) {
    if (typeof amount === 'number') return amount;
    if (!amount) return 0;
    // Remove currency symbols, commas, spaces
    const cleaned = amount.toString().replace(/[$,\s]/g, '');
    return parseFloat(cleaned) || 0;
}

/**
 * Main validation function - validates OCR extracted data against form data
 * @param {Object} extractedData - Data extracted from OCR
 * @param {Object} formData - Data submitted in form
 * @returns {Object} Validation results with fraud indicators
 */
function validateDocumentData(extractedData, formData) {
    const validationResults = {
        isValid: true,
        fraudScore: 0,
        indicators: [],
        details: {},
        warnings: [],
        timestamp: new Date().toISOString()
    };

    // Handle case where OCR failed or returned no data
    if (!extractedData || extractedData.error) {
        validationResults.warnings.push('Document OCR processing failed or returned no data');
        validationResults.details.ocrStatus = 'failed';
        validationResults.details.ocrError = extractedData?.error || 'Unknown error';
        return validationResults;
    }

    const structured = extractedData.structuredData || {};

    // ============== POLICY NUMBER VALIDATION ==============
    const extractedPolicyNumber = structured.policyNumber || extractedData.policyNumber;
    const submittedPolicyNumber = formData.policyNumber;

    validationResults.details.policyNumber = {
        extracted: extractedPolicyNumber,
        submitted: submittedPolicyNumber,
        match: false,
        similarity: 0
    };

    if (!extractedPolicyNumber) {
        // No policy number found in document
        validationResults.fraudScore += 15;
        validationResults.indicators.push('No policy number found in uploaded document');
        validationResults.details.policyNumber.status = 'not_found';
    } else {
        const normalizedExtracted = normalizePolicyNumber(extractedPolicyNumber);
        const normalizedSubmitted = normalizePolicyNumber(submittedPolicyNumber);

        if (normalizedExtracted === normalizedSubmitted) {
            validationResults.details.policyNumber.match = true;
            validationResults.details.policyNumber.similarity = 1;
            validationResults.details.policyNumber.status = 'match';
        } else {
            // Check similarity - might be OCR error
            const similarity = stringSimilarity(normalizedExtracted, normalizedSubmitted);
            validationResults.details.policyNumber.similarity = similarity;

            if (similarity >= 0.9) {
                // Very close - likely OCR error
                validationResults.details.policyNumber.status = 'probable_match';
                validationResults.details.policyNumber.match = true;
                validationResults.warnings.push(`Policy number close match (${Math.round(similarity * 100)}% similar) - possible OCR error`);
            } else {
                // Definite mismatch
                validationResults.fraudScore += 30;
                validationResults.indicators.push(`Policy number mismatch: document shows "${extractedPolicyNumber}", form submitted "${submittedPolicyNumber}"`);
                validationResults.details.policyNumber.status = 'mismatch';
                validationResults.isValid = false;
            }
        }
    }

    // ============== NAME VALIDATION ==============
    const extractedName = structured.policyHolder || structured.insuredName || extractedData.policyHolder;
    const submittedName = formData.claimantName;

    validationResults.details.claimantName = {
        extracted: extractedName,
        submitted: submittedName,
        match: false,
        similarity: 0
    };

    if (!extractedName) {
        validationResults.warnings.push('Could not extract policy holder name from document');
        validationResults.details.claimantName.status = 'not_found';
    } else {
        const normalizedExtracted = normalizeName(extractedName);
        const normalizedSubmitted = normalizeName(submittedName);

        const similarity = stringSimilarity(normalizedExtracted, normalizedSubmitted);
        validationResults.details.claimantName.similarity = similarity;

        if (similarity >= 0.95) {
            validationResults.details.claimantName.match = true;
            validationResults.details.claimantName.status = 'match';
        } else if (similarity >= 0.7) {
            // Close enough - might be nickname, middle name difference, etc.
            validationResults.details.claimantName.match = true;
            validationResults.details.claimantName.status = 'probable_match';
            validationResults.warnings.push(`Name similarity ${Math.round(similarity * 100)}%: "${extractedName}" vs "${submittedName}"`);
        } else {
            // More than 30% different - suspicious
            validationResults.fraudScore += 20;
            validationResults.indicators.push(`Name mismatch: document shows "${extractedName}", claim filed by "${submittedName}"`);
            validationResults.details.claimantName.status = 'mismatch';
            validationResults.isValid = false;
        }
    }

    // ============== COVERAGE AMOUNT VALIDATION ==============
    const coverageLimits = structured.coverageLimits || {};
    const claimAmount = parseAmount(formData.claimAmount);

    // Get the maximum coverage from limits
    let maxCoverage = 0;
    let coverageType = '';

    if (coverageLimits.perOccurrence) {
        maxCoverage = parseAmount(coverageLimits.perOccurrence);
        coverageType = 'per occurrence';
    } else if (coverageLimits.comprehensive) {
        maxCoverage = parseAmount(coverageLimits.comprehensive);
        coverageType = 'comprehensive';
    } else if (coverageLimits.collision) {
        maxCoverage = parseAmount(coverageLimits.collision);
        coverageType = 'collision';
    } else if (coverageLimits.dwelling) {
        maxCoverage = parseAmount(coverageLimits.dwelling);
        coverageType = 'dwelling';
    } else if (coverageLimits.personalProperty) {
        maxCoverage = parseAmount(coverageLimits.personalProperty);
        coverageType = 'personal property';
    }

    // Also check for a simpler coverageAmount field
    if (!maxCoverage && (structured.coverageAmount || extractedData.coverageAmount)) {
        maxCoverage = parseAmount(structured.coverageAmount || extractedData.coverageAmount);
        coverageType = 'total';
    }

    validationResults.details.coverageAmount = {
        extracted: maxCoverage,
        coverageType,
        claimAmount,
        exceeds: false
    };

    if (maxCoverage > 0) {
        if (claimAmount > maxCoverage) {
            validationResults.fraudScore += 25;
            validationResults.indicators.push(`Claim amount ($${claimAmount.toLocaleString()}) exceeds ${coverageType} coverage limit ($${maxCoverage.toLocaleString()})`);
            validationResults.details.coverageAmount.exceeds = true;
            validationResults.details.coverageAmount.status = 'exceeds_coverage';
            validationResults.isValid = false;
        } else if (claimAmount > maxCoverage * 0.9) {
            validationResults.warnings.push(`Claim amount ($${claimAmount.toLocaleString()}) is very close to coverage limit ($${maxCoverage.toLocaleString()})`);
            validationResults.details.coverageAmount.status = 'near_limit';
        } else {
            validationResults.details.coverageAmount.status = 'within_coverage';
        }
    } else {
        validationResults.details.coverageAmount.status = 'not_found';
        validationResults.warnings.push('Could not extract coverage amount from document');
    }

    // ============== EFFECTIVE DATE VALIDATION ==============
    const effectiveDate = structured.effectiveDate;
    const expirationDate = structured.expirationDate;
    const incidentDate = formData.incidentDate ? new Date(formData.incidentDate) : null;

    validationResults.details.policyDates = {
        effectiveDate,
        expirationDate,
        incidentDate: formData.incidentDate
    };

    if (effectiveDate && incidentDate) {
        const effectiveParsed = new Date(effectiveDate);
        if (!isNaN(effectiveParsed.getTime())) {
            if (incidentDate < effectiveParsed) {
                validationResults.fraudScore += 20;
                validationResults.indicators.push(`Incident date (${formData.incidentDate}) is before policy effective date (${effectiveDate})`);
                validationResults.details.policyDates.status = 'incident_before_effective';
                validationResults.isValid = false;
            } else {
                validationResults.details.policyDates.status = 'valid';
            }
        }
    }

    if (expirationDate && incidentDate) {
        const expirationParsed = new Date(expirationDate);
        if (!isNaN(expirationParsed.getTime())) {
            if (incidentDate > expirationParsed) {
                validationResults.fraudScore += 25;
                validationResults.indicators.push(`Incident date (${formData.incidentDate}) is after policy expiration (${expirationDate})`);
                validationResults.details.policyDates.status = 'incident_after_expiration';
                validationResults.isValid = false;
            }
        }
    }

    // ============== DOCUMENT AUTHENTICITY CHECK ==============
    if (extractedData.authenticity) {
        validationResults.details.authenticity = extractedData.authenticity;

        if (extractedData.authenticity.isAuthentic === false) {
            validationResults.fraudScore += 35;
            validationResults.indicators.push('Document authenticity check failed - possible forgery');
            validationResults.isValid = false;
        } else if (extractedData.authenticity.suspiciousElements?.length > 0) {
            validationResults.warnings.push(`Document has suspicious elements: ${extractedData.authenticity.suspiciousElements.join(', ')}`);
        }
    }

    // ============== DOCUMENT TYPE CHECK ==============
    if (extractedData.documentType) {
        validationResults.details.documentType = extractedData.documentType;

        if (extractedData.documentType.type !== 'policy' && extractedData.documentType.confidence > 0.7) {
            validationResults.warnings.push(`Uploaded document appears to be a "${extractedData.documentType.type}" rather than a policy document`);
            validationResults.fraudScore += 10;
        }
    }

    // ============== OCR CONFIDENCE CHECK ==============
    validationResults.details.ocrConfidence = extractedData.overallConfidence || extractedData.confidence || 0;

    if (validationResults.details.ocrConfidence < 50) {
        validationResults.warnings.push(`Low OCR confidence (${validationResults.details.ocrConfidence}%) - extracted data may be unreliable`);
    }

    // Cap fraud score at 100
    validationResults.fraudScore = Math.min(validationResults.fraudScore, 100);

    return validationResults;
}

/**
 * Quick validation - checks only critical fields
 * @param {Object} extractedData - OCR data
 * @param {Object} formData - Form data
 * @returns {Object} Quick validation result
 */
function quickValidation(extractedData, formData) {
    const structured = extractedData?.structuredData || {};

    const policyMatch = normalizePolicyNumber(structured.policyNumber) ===
        normalizePolicyNumber(formData.policyNumber);

    const nameSimilarity = stringSimilarity(
        normalizeName(structured.policyHolder),
        normalizeName(formData.claimantName)
    );

    return {
        policyNumberMatch: policyMatch,
        nameMatch: nameSimilarity >= 0.7,
        nameSimilarity,
        hasRedFlags: !policyMatch || nameSimilarity < 0.7
    };
}

module.exports = {
    validateDocumentData,
    quickValidation,
    stringSimilarity,
    normalizePolicyNumber,
    normalizeName,
    parseAmount
};
