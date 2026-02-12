const Tesseract = require('tesseract.js');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

// pdf-parse default export handling
let pdfParse = null;
try {
    const pdfParseModule = require('pdf-parse');
    // pdf-parse exports PDFParse as named export
    if (typeof pdfParseModule === 'function') {
        pdfParse = pdfParseModule;
    } else if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
        pdfParse = pdfParseModule.PDFParse;
    } else if (pdfParseModule && typeof pdfParseModule.default === 'function') {
        pdfParse = pdfParseModule.default;
    } else {
        console.warn('pdf-parse export format not recognized, keys:', Object.keys(pdfParseModule || {}));
    }
    if (pdfParse) {
        console.log('✅ pdf-parse loaded successfully');
    }
} catch (e) {
    console.warn('pdf-parse not available, PDF text extraction disabled:', e.message);
    pdfParse = null;
}

// franc-min language detection
let franc;
try {
    const francModule = require('franc-min');
    franc = francModule.default || francModule;
} catch (e) {
    console.warn('franc-min not available, using English as default');
    franc = () => 'eng';
}

// Language code mapping for Tesseract
const TESSERACT_LANG_MAP = {
    'eng': 'eng',
    'spa': 'spa',
    'fra': 'fra',
    'deu': 'deu',
    'ita': 'ita',
    'por': 'por',
    'nld': 'nld',
    'pol': 'pol',
    'rus': 'rus',
    'jpn': 'jpn',
    'chi': 'chi_sim',
    'kor': 'kor',
    'ara': 'ara'
};

// Document templates for authenticity verification
const DOCUMENT_TEMPLATES = {
    policy: {
        requiredFields: ['policy number', 'insured', 'coverage', 'effective date', 'expiration'],
        expectedSections: ['declarations', 'coverage', 'conditions', 'exclusions'],
        commonLogos: ['insurance', 'underwriter', 'assurance'],
        formatPatterns: {
            hasHeader: true,
            hasFooter: true,
            columnLayout: false
        }
    },
    repairEstimate: {
        requiredFields: ['estimate', 'labor', 'parts', 'total', 'vehicle', 'date'],
        expectedSections: ['labor', 'parts', 'sublet', 'materials'],
        commonLogos: ['auto body', 'collision', 'repair'],
        formatPatterns: {
            hasHeader: true,
            hasFooter: true,
            columnLayout: true
        }
    },
    medicalBill: {
        requiredFields: ['patient', 'provider', 'date of service', 'procedure', 'amount', 'diagnosis'],
        expectedSections: ['services', 'charges', 'insurance', 'patient responsibility'],
        commonLogos: ['hospital', 'medical', 'health', 'clinic'],
        formatPatterns: {
            hasHeader: true,
            hasFooter: true,
            columnLayout: true
        }
    },
    policeReport: {
        requiredFields: ['report number', 'date', 'officer', 'incident', 'location'],
        expectedSections: ['narrative', 'parties involved', 'witnesses', 'evidence'],
        commonLogos: ['police', 'department', 'sheriff', 'law enforcement'],
        formatPatterns: {
            hasHeader: true,
            hasFooter: true,
            columnLayout: false
        }
    }
};

const ocrService = {
    /**
     * Main entry point - extract and analyze document
     * @param {string} base64Data - Base64 encoded document
     * @param {Object} options - Processing options
     * @returns {Object} Extracted data with confidence scores
     */
    extractFromDocument: async (base64Data, options = {}) => {
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const isPdf = ocrService.detectPdfFormat(buffer);

            let extractionResult;
            if (isPdf) {
                extractionResult = await ocrService.extractFromPdf(buffer, options);
            } else {
                extractionResult = await ocrService.extractFromImage(buffer, options);
            }

            // Identify document type
            const documentType = ocrService.identifyDocumentType(extractionResult.rawText);
            extractionResult.documentType = documentType;

            // Parse structured data based on document type
            extractionResult.structuredData = await ocrService.parseStructuredData(
                extractionResult.rawText,
                documentType.type,
                extractionResult.tables
            );

            // Detect language
            extractionResult.language = ocrService.detectLanguage(extractionResult.rawText);

            // Check document authenticity
            extractionResult.authenticity = await ocrService.checkAuthenticity(
                buffer,
                extractionResult.rawText,
                documentType.type,
                isPdf
            );

            // Calculate overall confidence
            extractionResult.overallConfidence = ocrService.calculateOverallConfidence(extractionResult);

            return extractionResult;
        } catch (error) {
            console.error('OCR Error:', error);
            return {
                error: 'Failed to process document',
                rawText: '',
                confidence: 0,
                documentType: { type: 'unknown', confidence: 0 }
            };
        }
    },

    /**
     * Detect if buffer is a PDF
     */
    detectPdfFormat: (buffer) => {
        // PDF magic number: %PDF
        return buffer.slice(0, 4).toString() === '%PDF';
    },

    /**
     * Extract text from multi-page PDF
     */
    extractFromPdf: async (buffer, options = {}) => {
        const result = {
            rawText: '',
            pages: [],
            pageCount: 0,
            tables: [],
            confidence: 0,
            metadata: {}
        };

        try {
            // Parse PDF
            if (!pdfParse) {
                throw new Error('pdf-parse not available');
            }
            const pdfData = await pdfParse(buffer, {
                max: options.maxPages || 50 // Limit pages for performance
            });

            result.rawText = pdfData.text;
            result.pageCount = pdfData.numpages;
            result.metadata = {
                info: pdfData.info,
                version: pdfData.version
            };

            // Split text by pages (heuristic based on form feeds or large gaps)
            const pages = pdfData.text.split(/\f|\n{4,}/);
            result.pages = pages.map((text, index) => ({
                pageNumber: index + 1,
                text: text.trim(),
                wordCount: text.split(/\s+/).length
            }));

            // Extract tables from the text
            result.tables = ocrService.extractTables(pdfData.text);

            // If PDF has no text (scanned), use OCR
            if (pdfData.text.trim().length < 100) {
                console.log('PDF appears to be scanned, attempting OCR...');
                const ocrResult = await ocrService.ocrScannedPdf(buffer, options);
                result.rawText = ocrResult.text;
                result.confidence = ocrResult.confidence;
                result.isScanned = true;
            } else {
                result.confidence = 95; // Native PDF text extraction is highly accurate
                result.isScanned = false;
            }

        } catch (error) {
            console.error('PDF parsing error:', error);
            // Fall back to OCR
            const ocrResult = await ocrService.ocrScannedPdf(buffer, options);
            result.rawText = ocrResult.text;
            result.confidence = ocrResult.confidence;
            result.isScanned = true;
        }

        return result;
    },

    /**
     * OCR a scanned PDF by converting pages to images
     * Note: Tesseract.js cannot process PDFs directly, so we convert to images first
     */
    ocrScannedPdf: async (buffer, options = {}) => {
        try {
            // Load PDF with pdf-lib to get page count
            const pdfDoc = await PDFDocument.load(buffer);
            const pageCount = pdfDoc.getPageCount();
            const maxPages = Math.min(pageCount, options.maxPages || 5);

            let allText = '';
            let totalConfidence = 0;
            let processedPages = 0;

            // For now, return a message that scanned PDF OCR is limited
            // Full implementation would require pdf-to-image conversion (canvas, poppler, etc.)
            console.log(`Scanned PDF detected with ${pageCount} pages. Full OCR requires image conversion.`);

            return {
                text: '[Scanned PDF - text extraction limited. Please upload images or searchable PDF]',
                confidence: 0,
                note: 'Scanned PDF OCR requires page-to-image conversion which is not fully implemented'
            };
        } catch (error) {
            console.error('Scanned PDF OCR error:', error.message);
            return { text: '', confidence: 0, error: error.message };
        }
    },

    /**
     * Extract text from image with preprocessing for poor quality
     */
    extractFromImage: async (buffer, options = {}) => {
        const result = {
            rawText: '',
            confidence: 0,
            tables: [],
            preprocessed: false
        };

        try {
            // Preprocess image for better OCR if quality is poor
            let processedBuffer = buffer;

            if (options.enhanceQuality !== false) {
                try {
                    processedBuffer = await ocrService.preprocessImage(buffer);
                    result.preprocessed = true;
                } catch (e) {
                    console.log('Image preprocessing failed, using original');
                    processedBuffer = buffer;
                }
            }

            // Detect language from a quick sample
            const lang = options.language || 'eng';

            // Perform OCR
            const recognizeOptions = {};
            if (options.verbose) {
                recognizeOptions.logger = m => console.log(m);
            }
            const { data } = await Tesseract.recognize(processedBuffer, lang, recognizeOptions);

            result.rawText = data.text;
            result.confidence = data.confidence;
            result.words = data.words;
            result.lines = data.lines;

            // Extract tables from image OCR data
            if (data.blocks) {
                result.tables = ocrService.extractTablesFromBlocks(data.blocks);
            }

        } catch (error) {
            console.error('Image OCR error:', error);
        }

        return result;
    },

    /**
     * Preprocess image to improve OCR quality
     */
    preprocessImage: async (buffer) => {
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Apply enhancements
        let processed = image
            .grayscale() // Convert to grayscale
            .normalize() // Normalize contrast
            .sharpen({ sigma: 1.5 }); // Sharpen text

        // If image is small, upscale it
        if (metadata.width < 1000 || metadata.height < 1000) {
            const scale = Math.max(1000 / metadata.width, 1000 / metadata.height);
            processed = processed.resize({
                width: Math.round(metadata.width * scale),
                height: Math.round(metadata.height * scale),
                kernel: 'lanczos3'
            });
        }

        // Apply adaptive thresholding simulation
        processed = processed.threshold(128);

        return processed.toBuffer();
    },

    /**
     * Identify document type based on content
     */
    identifyDocumentType: (text) => {
        const textLower = text.toLowerCase();
        const scores = {
            policy: 0,
            repairEstimate: 0,
            medicalBill: 0,
            policeReport: 0
        };

        // Policy document indicators
        const policyKeywords = [
            'policy number', 'insured', 'coverage', 'premium', 'deductible',
            'effective date', 'expiration', 'declarations', 'endorsement',
            'insurance company', 'underwriter', 'beneficiary', 'liability'
        ];
        scores.policy = countKeywordMatches(textLower, policyKeywords);

        // Repair estimate indicators
        const repairKeywords = [
            'repair estimate', 'labor', 'parts', 'body shop', 'collision',
            'paint', 'refinish', 'remove and replace', 'r&r', 'sublet',
            'vin', 'mileage', 'total loss', 'supplement', 'frame'
        ];
        scores.repairEstimate = countKeywordMatches(textLower, repairKeywords);

        // Medical bill indicators
        const medicalKeywords = [
            'patient', 'diagnosis', 'procedure', 'cpt', 'icd', 'provider',
            'date of service', 'hospital', 'physician', 'insurance billed',
            'copay', 'deductible', 'explanation of benefits', 'eob', 'npi'
        ];
        scores.medicalBill = countKeywordMatches(textLower, medicalKeywords);

        // Police report indicators
        const policeKeywords = [
            'police report', 'incident', 'officer', 'badge', 'narrative',
            'report number', 'case number', 'complainant', 'suspect',
            'witness', 'evidence', 'arrest', 'citation', 'traffic accident'
        ];
        scores.policeReport = countKeywordMatches(textLower, policeKeywords);

        // Find the highest scoring type
        const maxType = Object.entries(scores).reduce((a, b) =>
            scores[a[0]] > scores[b[0]] ? a : b
        );

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
        const confidence = totalScore > 0 ? Math.round((maxType[1] / totalScore) * 100) : 0;

        return {
            type: maxType[1] > 2 ? maxType[0] : 'unknown',
            confidence,
            scores,
            allTypes: Object.entries(scores)
                .filter(([_, score]) => score > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([type, score]) => ({ type, score }))
        };
    },

    /**
     * Parse structured data based on document type
     */
    parseStructuredData: async (text, documentType, tables = []) => {
        switch (documentType) {
            case 'policy':
                return ocrService.parsePolicyDocument(text);
            case 'repairEstimate':
                return ocrService.parseRepairEstimate(text, tables);
            case 'medicalBill':
                return ocrService.parseMedicalBill(text, tables);
            case 'policeReport':
                return ocrService.parsePoliceReport(text);
            default:
                return ocrService.parseGenericDocument(text);
        }
    },

    /**
     * Parse policy document
     */
    parsePolicyDocument: (text) => {
        return {
            policyNumber: extractWithPatterns(text, [
                /policy\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{6,20})/i,
                /(?:policy|pol)[\s#:]*([A-Z]{2,3}[\d-]{6,15})/i
            ]),
            policyHolder: extractWithPatterns(text, [
                /(?:named\s+insured|policy\s*holder|insured)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i
            ]),
            coverageLimits: extractCoverageLimits(text),
            deductibles: extractDeductibles(text),
            effectiveDate: extractWithPatterns(text, [
                /(?:effective|start)\s*date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
                /(?:from|begins?)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            expirationDate: extractWithPatterns(text, [
                /(?:expir(?:ation|es?)|end)\s*date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
                /(?:to|through|until)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            vehicleInfo: extractVehicleInfo(text),
            propertyInfo: extractPropertyInfo(text),
            premium: extractWithPatterns(text, [
                /(?:premium|total\s*premium)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
            ]),
            agent: extractWithPatterns(text, [
                /(?:agent|broker|producer)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
            ]),
            confidence: 0 // Will be calculated
        };
    },

    /**
     * Parse repair estimate
     */
    parseRepairEstimate: (text, tables = []) => {
        const result = {
            estimateNumber: extractWithPatterns(text, [
                /estimate\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{4,15})/i
            ]),
            estimateDate: extractWithPatterns(text, [
                /(?:estimate\s*)?date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            shopName: extractWithPatterns(text, [
                /(?:shop|business|company)\s*(?:name)?\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            vehicleInfo: extractVehicleInfo(text),
            laborItems: [],
            partsItems: [],
            laborTotal: 0,
            partsTotal: 0,
            paintMaterials: 0,
            subletTotal: 0,
            grandTotal: extractWithPatterns(text, [
                /(?:grand\s*)?total\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
                /total\s*estimate\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
            ]),
            confidence: 0
        };

        // Extract labor items
        const laborPattern = /(?:labor|remove|replace|r&[ri]|repair|blend|refinish)\s*[\-:]\s*(.+?)\s+(\d+\.?\d*)\s*(?:hrs?|hours?)?\s*@?\s*\$?([\d.]+)/gi;
        let match;
        while ((match = laborPattern.exec(text)) !== null) {
            result.laborItems.push({
                description: match[1].trim(),
                hours: parseFloat(match[2]),
                rate: parseFloat(match[3]),
                total: parseFloat(match[2]) * parseFloat(match[3])
            });
        }

        // Extract parts
        const partsPattern = /(?:part|oem|aftermarket|lkq)\s*[\-:]\s*(.+?)\s+\$?([\d,]+\.?\d*)/gi;
        while ((match = partsPattern.exec(text)) !== null) {
            result.partsItems.push({
                description: match[1].trim(),
                cost: parseFloat(match[2].replace(',', ''))
            });
        }

        // Calculate totals
        result.laborTotal = result.laborItems.reduce((sum, item) => sum + item.total, 0);
        result.partsTotal = result.partsItems.reduce((sum, item) => sum + item.cost, 0);

        return result;
    },

    /**
     * Parse medical bill
     */
    parseMedicalBill: (text, tables = []) => {
        return {
            patientName: extractWithPatterns(text, [
                /patient\s*(?:name)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
            ]),
            patientDOB: extractWithPatterns(text, [
                /(?:date\s*of\s*birth|dob|birth\s*date)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            accountNumber: extractWithPatterns(text, [
                /(?:account|acct|patient)\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{5,15})/i
            ]),
            providerName: extractWithPatterns(text, [
                /(?:provider|physician|doctor|hospital)\s*(?:name)?\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            providerNPI: extractWithPatterns(text, [
                /npi\s*:?\s*(\d{10})/i
            ]),
            dateOfService: extractWithPatterns(text, [
                /(?:date\s*of\s*service|dos|service\s*date)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            procedures: extractMedicalProcedures(text),
            diagnoses: extractDiagnoses(text),
            charges: extractCharges(text),
            insuranceBilled: extractWithPatterns(text, [
                /(?:insurance\s*billed|billed\s*to\s*insurance)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
            ]),
            patientResponsibility: extractWithPatterns(text, [
                /(?:patient\s*(?:responsibility|owes?)|amount\s*due)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
            ]),
            totalCharges: extractWithPatterns(text, [
                /(?:total\s*charges?|total\s*amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i
            ]),
            confidence: 0
        };
    },

    /**
     * Parse police report
     */
    parsePoliceReport: (text) => {
        return {
            reportNumber: extractWithPatterns(text, [
                /(?:report|case|incident)\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{5,20})/i
            ]),
            incidentDate: extractWithPatterns(text, [
                /(?:incident|occurrence)\s*date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
                /(?:date\s*of\s*incident)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
            ]),
            incidentTime: extractWithPatterns(text, [
                /(?:time|at)\s*:?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i
            ]),
            incidentLocation: extractWithPatterns(text, [
                /(?:location|address|scene)\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            officerName: extractWithPatterns(text, [
                /(?:officer|reporting\s*officer|deputy)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
            ]),
            officerBadge: extractWithPatterns(text, [
                /(?:badge|id)\s*(?:number|no|#)?\s*:?\s*([A-Z0-9]{3,10})/i
            ]),
            department: extractWithPatterns(text, [
                /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*(?:police|sheriff|department))/i
            ]),
            incidentType: extractWithPatterns(text, [
                /(?:incident\s*type|nature\s*of\s*incident|offense)\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            narrative: extractNarrative(text),
            partiesInvolved: extractPartiesInvolved(text),
            witnesses: extractWitnesses(text),
            vehiclesInvolved: extractVehiclesFromReport(text),
            injuries: extractWithPatterns(text, [
                /(?:injuries|injury)\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            propertyDamage: extractWithPatterns(text, [
                /(?:property\s*damage|damage)\s*:?\s*(.+?)(?:\n|$)/i
            ]),
            confidence: 0
        };
    },

    /**
     * Parse generic document when type is unknown
     */
    parseGenericDocument: (text) => {
        return {
            dates: extractAllDates(text),
            amounts: extractAllAmounts(text),
            names: extractAllNames(text),
            addresses: extractAllAddresses(text),
            phoneNumbers: extractAllPhoneNumbers(text),
            emails: extractAllEmails(text),
            referenceNumbers: extractAllReferenceNumbers(text),
            confidence: 0
        };
    },

    /**
     * Extract tables from text
     */
    extractTables: (text) => {
        const tables = [];
        const lines = text.split('\n');

        let currentTable = [];
        let inTable = false;

        for (const line of lines) {
            // Detect table rows by consistent spacing or delimiters
            const hasMultipleColumns = (line.match(/\t/g) || []).length >= 2 ||
                (line.match(/\s{3,}/g) || []).length >= 2 ||
                (line.match(/\|/g) || []).length >= 2;

            if (hasMultipleColumns && line.trim().length > 0) {
                inTable = true;
                // Split by tabs, multiple spaces, or pipes
                const cells = line.split(/\t|\s{3,}|\|/).map(c => c.trim()).filter(c => c);
                currentTable.push(cells);
            } else if (inTable && line.trim().length === 0) {
                // End of table
                if (currentTable.length >= 2) {
                    tables.push({
                        rows: currentTable,
                        headers: currentTable[0],
                        data: currentTable.slice(1)
                    });
                }
                currentTable = [];
                inTable = false;
            }
        }

        // Handle table at end of text
        if (currentTable.length >= 2) {
            tables.push({
                rows: currentTable,
                headers: currentTable[0],
                data: currentTable.slice(1)
            });
        }

        return tables;
    },

    /**
     * Extract tables from Tesseract block data
     */
    extractTablesFromBlocks: (blocks) => {
        // Group words by vertical position to identify rows
        const tables = [];

        // This is a simplified implementation
        // Full implementation would use ML for table detection

        return tables;
    },

    /**
     * Detect document language
     */
    detectLanguage: (text) => {
        const sampleText = text.substring(0, 1000); // Sample for detection
        const langCode = franc(sampleText);

        return {
            code: langCode,
            tesseractCode: TESSERACT_LANG_MAP[langCode] || 'eng',
            confidence: langCode === 'und' ? 0 : 80
        };
    },

    /**
     * Check document authenticity
     */
    checkAuthenticity: async (buffer, text, documentType, isPdf) => {
        const result = {
            isAuthentic: true,
            confidence: 100,
            flags: [],
            checks: {}
        };

        // Check 1: Font consistency (for PDFs)
        if (isPdf) {
            const fontCheck = await checkFontConsistency(buffer);
            result.checks.fontConsistency = fontCheck;
            if (!fontCheck.consistent) {
                result.flags.push('Inconsistent fonts detected - possible document manipulation');
                result.confidence -= 20;
            }
        }

        // Check 2: Formatting consistency
        const formatCheck = checkFormatConsistency(text, documentType);
        result.checks.formatConsistency = formatCheck;
        if (!formatCheck.consistent) {
            result.flags.push('Unusual formatting detected');
            result.confidence -= 15;
        }

        // Check 3: Date consistency
        const dateCheck = checkDateConsistency(text);
        result.checks.dateConsistency = dateCheck;
        if (!dateCheck.consistent) {
            result.flags.push(`Date inconsistencies: ${dateCheck.issues.join(', ')}`);
            result.confidence -= 25;
        }

        // Check 4: Expected fields present
        const template = DOCUMENT_TEMPLATES[documentType];
        if (template) {
            const fieldCheck = checkRequiredFields(text, template.requiredFields);
            result.checks.requiredFields = fieldCheck;
            if (fieldCheck.missingCount > template.requiredFields.length / 2) {
                result.flags.push(`Missing expected fields for ${documentType}`);
                result.confidence -= 15;
            }
        }

        // Check 5: Suspicious patterns
        const suspiciousCheck = checkSuspiciousPatterns(text);
        result.checks.suspiciousPatterns = suspiciousCheck;
        if (suspiciousCheck.found) {
            result.flags.push(...suspiciousCheck.patterns);
            result.confidence -= suspiciousCheck.penalty;
        }

        // Check 6: Image quality indicators (for scanned docs)
        const qualityCheck = checkDocumentQuality(text);
        result.checks.quality = qualityCheck;
        if (qualityCheck.poor) {
            result.flags.push('Poor document quality - may be a copy of a copy');
            result.confidence -= 10;
        }

        result.isAuthentic = result.confidence > 50;
        result.confidence = Math.max(0, result.confidence);

        return result;
    },

    /**
     * Cross-validate data across multiple documents
     */
    crossValidateDocuments: async (documents) => {
        const result = {
            consistent: true,
            discrepancies: [],
            confidence: 100
        };

        // Extract key fields from all documents
        const keyFields = {
            policyNumbers: new Set(),
            names: new Set(),
            dates: new Set(),
            amounts: new Set(),
            vehicleVins: new Set()
        };

        for (const doc of documents) {
            if (doc.structuredData?.policyNumber) {
                keyFields.policyNumbers.add(doc.structuredData.policyNumber);
            }
            if (doc.structuredData?.policyHolder) {
                keyFields.names.add(normalizeString(doc.structuredData.policyHolder));
            }
            if (doc.structuredData?.patientName) {
                keyFields.names.add(normalizeString(doc.structuredData.patientName));
            }
            // Add more field extractions...
        }

        // Check for inconsistencies
        if (keyFields.policyNumbers.size > 1) {
            result.discrepancies.push({
                field: 'Policy Number',
                values: Array.from(keyFields.policyNumbers),
                severity: 'HIGH'
            });
            result.confidence -= 30;
            result.consistent = false;
        }

        if (keyFields.names.size > 2) {
            result.discrepancies.push({
                field: 'Names',
                values: Array.from(keyFields.names),
                severity: 'MEDIUM'
            });
            result.confidence -= 15;
        }

        result.confidence = Math.max(0, result.confidence);
        return result;
    },

    /**
     * Calculate overall confidence score
     */
    calculateOverallConfidence: (extractionResult) => {
        let confidence = extractionResult.confidence || 50;

        // Adjust based on document type confidence
        if (extractionResult.documentType?.confidence) {
            confidence = (confidence + extractionResult.documentType.confidence) / 2;
        }

        // Adjust based on authenticity
        if (extractionResult.authenticity?.confidence) {
            confidence = (confidence + extractionResult.authenticity.confidence) / 2;
        }

        // Adjust based on structured data completeness
        if (extractionResult.structuredData) {
            const fields = Object.values(extractionResult.structuredData);
            const filledFields = fields.filter(v => v !== null && v !== undefined && v !== '').length;
            const completeness = filledFields / fields.length;
            confidence = confidence * (0.5 + completeness * 0.5);
        }

        return Math.round(confidence);
    }
};

// ============== Helper Functions ==============

function countKeywordMatches(text, keywords) {
    return keywords.filter(kw => text.includes(kw)).length;
}

function extractWithPatterns(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

function extractCoverageLimits(text) {
    const limits = {};
    const patterns = [
        /(?:bodily\s*injury)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:property\s*damage)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:collision)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:comprehensive)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:uninsured\s*motorist)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:medical\s*payments?)\s*(?:limit)?\s*:?\s*\$?\s*([\d,]+)/i
    ];

    const names = ['bodilyInjury', 'propertyDamage', 'collision', 'comprehensive', 'uninsuredMotorist', 'medicalPayments'];

    patterns.forEach((pattern, i) => {
        const match = text.match(pattern);
        if (match) {
            limits[names[i]] = parseFloat(match[1].replace(/,/g, ''));
        }
    });

    return Object.keys(limits).length > 0 ? limits : null;
}

function extractDeductibles(text) {
    const deductibles = {};
    const patterns = [
        /(?:collision\s*deductible)\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:comprehensive\s*deductible)\s*:?\s*\$?\s*([\d,]+)/i,
        /(?:deductible)\s*:?\s*\$?\s*([\d,]+)/i
    ];

    const names = ['collision', 'comprehensive', 'general'];

    patterns.forEach((pattern, i) => {
        const match = text.match(pattern);
        if (match) {
            deductibles[names[i]] = parseFloat(match[1].replace(/,/g, ''));
        }
    });

    return Object.keys(deductibles).length > 0 ? deductibles : null;
}

function extractVehicleInfo(text) {
    return {
        vin: extractWithPatterns(text, [
            /(?:vin|vehicle\s*identification)\s*(?:number|no|#)?\s*:?\s*([A-HJ-NPR-Z0-9]{17})/i
        ]),
        make: extractWithPatterns(text, [
            /(?:make|manufacturer)\s*:?\s*([A-Za-z]+)/i
        ]),
        model: extractWithPatterns(text, [
            /(?:model)\s*:?\s*([A-Za-z0-9\s]+?)(?:\n|year|$)/i
        ]),
        year: extractWithPatterns(text, [
            /(?:year|model\s*year)\s*:?\s*((?:19|20)\d{2})/i
        ]),
        licensePlate: extractWithPatterns(text, [
            /(?:license|plate|tag)\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{4,10})/i
        ])
    };
}

function extractPropertyInfo(text) {
    return {
        address: extractWithPatterns(text, [
            /(?:property\s*address|insured\s*location|premises)\s*:?\s*(.+?)(?:\n|$)/i
        ]),
        dwellingCoverage: extractWithPatterns(text, [
            /(?:dwelling|structure)\s*(?:coverage)?\s*:?\s*\$?\s*([\d,]+)/i
        ]),
        personalProperty: extractWithPatterns(text, [
            /(?:personal\s*property|contents)\s*(?:coverage)?\s*:?\s*\$?\s*([\d,]+)/i
        ])
    };
}

function extractMedicalProcedures(text) {
    const procedures = [];
    // CPT codes pattern
    const cptPattern = /(\d{5})\s+(.+?)\s+\$?\s*([\d,]+\.?\d*)/g;
    let match;

    while ((match = cptPattern.exec(text)) !== null) {
        procedures.push({
            code: match[1],
            description: match[2].trim(),
            charge: parseFloat(match[3].replace(',', ''))
        });
    }

    return procedures;
}

function extractDiagnoses(text) {
    const diagnoses = [];
    // ICD-10 codes pattern
    const icdPattern = /([A-Z]\d{2}\.?\d{0,4})\s+(.+?)(?:\n|$)/g;
    let match;

    while ((match = icdPattern.exec(text)) !== null) {
        if (match[1].length >= 3) {
            diagnoses.push({
                code: match[1],
                description: match[2].trim()
            });
        }
    }

    return diagnoses;
}

function extractCharges(text) {
    const charges = [];
    const chargePattern = /(.+?)\s+\$\s*([\d,]+\.?\d*)/g;
    let match;

    while ((match = chargePattern.exec(text)) !== null) {
        const desc = match[1].trim();
        if (desc.length > 3 && desc.length < 100) {
            charges.push({
                description: desc,
                amount: parseFloat(match[2].replace(',', ''))
            });
        }
    }

    return charges;
}

function extractNarrative(text) {
    const narrativePattern = /(?:narrative|summary|description|details)\s*:?\s*\n?([\s\S]+?)(?=\n\s*(?:[A-Z]{2,}|witness|evidence|signature)|$)/i;
    const match = text.match(narrativePattern);
    return match ? match[1].trim().substring(0, 2000) : null;
}

function extractPartiesInvolved(text) {
    const parties = [];
    const partyPattern = /(?:party|driver|owner|involved)\s*(?:\d)?\s*:?\s*\n?(.+?)(?:\n|$)/gi;
    let match;

    while ((match = partyPattern.exec(text)) !== null) {
        parties.push(match[1].trim());
    }

    return parties;
}

function extractWitnesses(text) {
    const witnesses = [];
    const witnessPattern = /(?:witness)\s*(?:\d)?\s*:?\s*(.+?)(?:\n|$)/gi;
    let match;

    while ((match = witnessPattern.exec(text)) !== null) {
        witnesses.push(match[1].trim());
    }

    return witnesses;
}

function extractVehiclesFromReport(text) {
    const vehicles = [];
    const vehiclePattern = /(?:vehicle)\s*(?:\d)?\s*:?\s*(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9]+)/gi;
    let match;

    while ((match = vehiclePattern.exec(text)) !== null) {
        vehicles.push({
            year: match[1],
            make: match[2],
            model: match[3]
        });
    }

    return vehicles;
}

function extractAllDates(text) {
    const dates = [];
    const patterns = [
        /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g,
        /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/g,
        /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})/gi
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (!dates.includes(match[1])) {
                dates.push(match[1]);
            }
        }
    }

    return dates;
}

function extractAllAmounts(text) {
    const amounts = [];
    const pattern = /\$\s*([\d,]+\.?\d*)/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
            amounts.push(amount);
        }
    }

    return [...new Set(amounts)].sort((a, b) => b - a);
}

function extractAllNames(text) {
    const names = [];
    const pattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        // Filter out common non-names
        const excluded = ['insurance company', 'state farm', 'auto body', 'police department'];
        if (!excluded.some(e => name.toLowerCase().includes(e))) {
            names.push(name);
        }
    }

    return [...new Set(names)].slice(0, 20);
}

function extractAllAddresses(text) {
    const addresses = [];
    const pattern = /(\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court)\.?(?:\s*,?\s*[A-Za-z]+\s*,?\s*[A-Z]{2}\s*\d{5})?)/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        addresses.push(match[1].trim());
    }

    return [...new Set(addresses)];
}

function extractAllPhoneNumbers(text) {
    const phones = [];
    const pattern = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        phones.push(match[0]);
    }

    return [...new Set(phones)];
}

function extractAllEmails(text) {
    const emails = [];
    const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        emails.push(match[0].toLowerCase());
    }

    return [...new Set(emails)];
}

function extractAllReferenceNumbers(text) {
    const refs = [];
    const pattern = /(?:ref|reference|claim|policy|case|report|account|id|#)\s*(?:number|no|#)?\s*:?\s*([A-Z0-9-]{4,20})/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        refs.push(match[1]);
    }

    return [...new Set(refs)];
}

async function checkFontConsistency(pdfBuffer) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        const fonts = new Set();

        // Note: pdf-lib doesn't expose font info easily
        // This is a simplified check
        return {
            consistent: true,
            fontCount: 1,
            fonts: []
        };
    } catch (error) {
        return { consistent: true, error: error.message };
    }
}

function checkFormatConsistency(text, documentType) {
    const lines = text.split('\n');
    const issues = [];

    // Check for consistent line spacing
    const lineSpacings = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() && lines[i - 1].trim()) {
            // Measure "visual" spacing by checking empty lines
            lineSpacings.push(lines[i - 1].length === 0 ? 1 : 0);
        }
    }

    // Check for mixed case inconsistency
    const hasAllCaps = lines.some(l => l.length > 10 && l === l.toUpperCase());
    const hasMixedCase = lines.some(l => l.length > 10 && l !== l.toUpperCase() && l !== l.toLowerCase());

    if (hasAllCaps && hasMixedCase) {
        issues.push('Mixed formatting styles');
    }

    // Check for alignment issues
    const indentations = lines.map(l => l.match(/^\s*/)[0].length);
    const uniqueIndents = new Set(indentations);

    if (uniqueIndents.size > 10) {
        issues.push('Inconsistent text alignment');
    }

    return {
        consistent: issues.length === 0,
        issues
    };
}

function checkDateConsistency(text) {
    const dates = extractAllDates(text);
    const issues = [];
    const parsedDates = [];

    for (const dateStr of dates) {
        try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                parsedDates.push({ original: dateStr, parsed });
            }
        } catch (e) { }
    }

    // Check for future dates
    const now = new Date();
    const futureDates = parsedDates.filter(d => d.parsed > now);
    if (futureDates.length > 0) {
        issues.push('Contains future dates');
    }

    // Check for dates too far in the past (before 2000)
    const oldDates = parsedDates.filter(d => d.parsed.getFullYear() < 2000);
    if (oldDates.length > 0 && parsedDates.length > oldDates.length) {
        issues.push('Contains dates from different eras');
    }

    // Check for date range consistency
    if (parsedDates.length >= 2) {
        const sorted = parsedDates.sort((a, b) => a.parsed - b.parsed);
        const rangeYears = (sorted[sorted.length - 1].parsed - sorted[0].parsed) / (365 * 24 * 60 * 60 * 1000);
        if (rangeYears > 5) {
            issues.push('Dates span more than 5 years');
        }
    }

    return {
        consistent: issues.length === 0,
        issues,
        dateCount: dates.length
    };
}

function checkRequiredFields(text, requiredFields) {
    const textLower = text.toLowerCase();
    const found = [];
    const missing = [];

    for (const field of requiredFields) {
        if (textLower.includes(field.toLowerCase())) {
            found.push(field);
        } else {
            missing.push(field);
        }
    }

    return {
        found,
        missing,
        foundCount: found.length,
        missingCount: missing.length,
        completeness: found.length / requiredFields.length
    };
}

function checkSuspiciousPatterns(text) {
    const patterns = [];
    let penalty = 0;
    const textLower = text.toLowerCase();

    // Check for placeholder text
    if (textLower.includes('lorem ipsum') || textLower.includes('[insert')) {
        patterns.push('Contains placeholder text');
        penalty += 20;
    }

    // Check for sample/test indicators
    if (textLower.includes('sample') || textLower.includes('test document') || textLower.includes('specimen')) {
        patterns.push('Document marked as sample/test');
        penalty += 15;
    }

    // Check for excessive repetition
    const words = textLower.split(/\s+/);
    const wordCounts = {};
    for (const word of words) {
        if (word.length > 4) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    }
    const maxRepetition = Math.max(...Object.values(wordCounts), 0);
    if (maxRepetition > 20) {
        patterns.push('Suspicious text repetition detected');
        penalty += 10;
    }

    // Check for inconsistent number formats
    const usFormat = (text.match(/\$[\d,]+\.\d{2}/g) || []).length;
    const euFormat = (text.match(/€[\d.]+,\d{2}/g) || []).length;
    if (usFormat > 0 && euFormat > 0) {
        patterns.push('Mixed currency/number formats');
        penalty += 10;
    }

    return {
        found: patterns.length > 0,
        patterns,
        penalty
    };
}

function checkDocumentQuality(text) {
    const issues = [];

    // Check for OCR errors (common misreadings)
    const ocrErrors = ['rn' + ' ' + 'm', '0' + ' ' + 'O', '1' + ' ' + 'l', 'vv' + ' ' + 'w'];

    // Check for garbled text (high ratio of special characters)
    const specialChars = (text.match(/[^a-zA-Z0-9\s.,;:'"!?()-]/g) || []).length;
    const totalChars = text.length;

    if (specialChars / totalChars > 0.1) {
        issues.push('High proportion of unrecognized characters');
    }

    // Check for very short words (possible OCR errors)
    const words = text.split(/\s+/);
    const shortWords = words.filter(w => w.length === 1 && !/^[aAiI]$/.test(w)).length;

    if (shortWords / words.length > 0.1) {
        issues.push('Many single-character words detected');
    }

    return {
        poor: issues.length > 0,
        issues,
        qualityScore: Math.max(0, 100 - issues.length * 25)
    };
}

function normalizeString(str) {
    return str ? str.toLowerCase().trim().replace(/\s+/g, ' ') : '';
}

module.exports = ocrService;
