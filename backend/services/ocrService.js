const Tesseract = require('tesseract.js');

const ocrService = {
    // Extract text from base64 document
    extractFromDocument: async (base64Data) => {
        try {
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');

            // Perform OCR
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
                logger: m => console.log(m) // Optional: shows progress
            });

            // Extract key information using regex patterns
            const extracted = {
                rawText: text,
                policyNumber: extractPolicyNumber(text),
                policyHolder: extractPolicyHolder(text),
                coverageAmount: extractCoverageAmount(text),
                effectiveDate: extractDate(text)
            };

            return extracted;
        } catch (error) {
            console.error('OCR Error:', error);
            return { error: 'Failed to process document', rawText: '' };
        }
    }
};

// Helper functions to extract specific data
function extractPolicyNumber(text) {
    const patterns = [
        /policy\s*(?:number|no|#)?\s*:?\s*([A-Z0-9]{6,15})/i,
        /([A-Z]{2,3}\d{6,10})/,
    ];

    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function extractPolicyHolder(text) {
    const patterns = [
        /(?:insured|policy\s*holder|name)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];

    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function extractCoverageAmount(text) {
    const patterns = [
        /(?:coverage|sum\s*insured|amount)\s*:?\s*\$?\s*([\d,]+)/i,
    ];

    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].replace(/,/g, '');
    }
    return null;
}

function extractDate(text) {
    const patterns = [
        /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
        /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
    ];

    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return null;
}

module.exports = ocrService;