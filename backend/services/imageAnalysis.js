const sharp = require('sharp');
const ExifParser = require('exif-parser');
const imghash = require('imghash');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// In-memory store for perceptual hashes (in production, use Redis/DB)
const hashStore = new Map();

const imageAnalysis = {
    /**
     * Analyze a single damage photo for fraud indicators
     * @param {Buffer|string} imageInput - Image buffer or file path
     * @param {Object} claimData - Claim information for context
     * @returns {Object} Analysis results with fraud indicators
     */
    analyzeImage: async (imageInput, claimData = {}) => {
        const results = {
            fraudIndicators: [],
            fraudScore: 0,
            metadata: {},
            quality: {},
            duplicateCheck: {},
            claimTypeMatch: {},
            confidence: 0
        };

        try {
            // Get image buffer
            const imageBuffer = typeof imageInput === 'string'
                ? await fs.readFile(imageInput)
                : imageInput;

            // Run all analyses in parallel
            const [
                exifResults,
                qualityResults,
                editDetection,
                hashResults,
                objectDetection
            ] = await Promise.all([
                imageAnalysis.extractExifMetadata(imageBuffer),
                imageAnalysis.analyzeImageQuality(imageBuffer),
                imageAnalysis.detectImageEditing(imageBuffer),
                imageAnalysis.calculatePerceptualHash(imageBuffer, claimData.policyNumber),
                imageAnalysis.detectObjects(imageBuffer)
            ]);

            // Merge results
            results.metadata = exifResults.metadata;
            results.fraudIndicators.push(...exifResults.fraudIndicators);
            results.fraudScore += exifResults.fraudScore;

            results.quality = qualityResults.quality;
            results.fraudIndicators.push(...qualityResults.fraudIndicators);
            results.fraudScore += qualityResults.fraudScore;

            results.fraudIndicators.push(...editDetection.fraudIndicators);
            results.fraudScore += editDetection.fraudScore;
            results.editingDetected = editDetection.editingDetected;

            results.duplicateCheck = hashResults.duplicateCheck;
            results.fraudIndicators.push(...hashResults.fraudIndicators);
            results.fraudScore += hashResults.fraudScore;

            results.detectedObjects = objectDetection.objects;

            // Verify claim type matches image content
            const claimTypeVerification = imageAnalysis.verifyClaimType(
                objectDetection.objects,
                claimData.claimType
            );
            results.claimTypeMatch = claimTypeVerification;
            results.fraudIndicators.push(...claimTypeVerification.fraudIndicators);
            results.fraudScore += claimTypeVerification.fraudScore;

            // Check image date vs incident date
            if (results.metadata.dateTime && claimData.incidentDate) {
                const dateCheck = imageAnalysis.verifyImageDate(
                    results.metadata.dateTime,
                    claimData.incidentDate
                );
                results.fraudIndicators.push(...dateCheck.fraudIndicators);
                results.fraudScore += dateCheck.fraudScore;
            }

            // Cap fraud score at 100
            results.fraudScore = Math.min(results.fraudScore, 100);
            results.confidence = calculateConfidence(results);
            results.riskLevel = getRiskLevel(results.fraudScore);

        } catch (error) {
            console.error('Image analysis error:', error);
            results.error = error.message;
            results.fraudIndicators.push('Image analysis failed - possible corrupt or invalid file');
            results.fraudScore += 15;
        }

        return results;
    },

    /**
     * Analyze multiple damage photos
     * @param {Array} images - Array of image buffers or paths
     * @param {Object} claimData - Claim information
     * @returns {Object} Combined analysis results
     */
    analyzeMultipleImages: async (images, claimData = {}) => {
        const allResults = [];
        const allHashes = [];

        for (const image of images) {
            const result = await imageAnalysis.analyzeImage(image, claimData);
            allResults.push(result);
            if (result.duplicateCheck?.hash) {
                allHashes.push(result.duplicateCheck.hash);
            }
        }

        // Check for internal duplicates (same photos submitted multiple times)
        const internalDuplicates = findInternalDuplicates(allHashes);

        const combined = {
            imageCount: images.length,
            individualResults: allResults,
            combinedFraudScore: 0,
            combinedIndicators: [],
            overallRiskLevel: 'LOW',
            confidence: 0
        };

        // Aggregate fraud scores (weighted average)
        const totalScore = allResults.reduce((sum, r) => sum + r.fraudScore, 0);
        combined.combinedFraudScore = Math.round(totalScore / allResults.length);

        // Collect unique indicators
        const indicatorSet = new Set();
        allResults.forEach(r => r.fraudIndicators.forEach(i => indicatorSet.add(i)));
        combined.combinedIndicators = Array.from(indicatorSet);

        // Add internal duplicate penalty
        if (internalDuplicates.length > 0) {
            combined.combinedIndicators.push(`${internalDuplicates.length} duplicate images detected in submission`);
            combined.combinedFraudScore += 20;
        }

        // No images is suspicious
        if (images.length === 0) {
            combined.combinedIndicators.push('No damage photos provided');
            combined.combinedFraudScore += 15;
        }

        combined.combinedFraudScore = Math.min(combined.combinedFraudScore, 100);
        combined.overallRiskLevel = getRiskLevel(combined.combinedFraudScore);
        combined.confidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / Math.max(allResults.length, 1);

        return combined;
    },

    /**
     * Extract EXIF metadata from image
     */
    extractExifMetadata: async (imageBuffer) => {
        const result = {
            metadata: {},
            fraudIndicators: [],
            fraudScore: 0
        };

        try {
            const parser = ExifParser.create(imageBuffer);
            const exifData = parser.parse();

            result.metadata = {
                dateTime: exifData.tags?.DateTimeOriginal
                    ? new Date(exifData.tags.DateTimeOriginal * 1000).toISOString()
                    : null,
                gpsLatitude: exifData.tags?.GPSLatitude || null,
                gpsLongitude: exifData.tags?.GPSLongitude || null,
                cameraMake: exifData.tags?.Make || null,
                cameraModel: exifData.tags?.Model || null,
                software: exifData.tags?.Software || null,
                imageWidth: exifData.imageSize?.width || null,
                imageHeight: exifData.imageSize?.height || null,
                orientation: exifData.tags?.Orientation || null
            };

            // Check for editing software indicators
            const editingSoftware = ['photoshop', 'gimp', 'lightroom', 'snapseed', 'picsart'];
            if (result.metadata.software) {
                const softwareLower = result.metadata.software.toLowerCase();
                for (const editor of editingSoftware) {
                    if (softwareLower.includes(editor)) {
                        result.fraudIndicators.push(`Image edited with ${result.metadata.software}`);
                        result.fraudScore += 20;
                        break;
                    }
                }
            }

            // Check if metadata is completely stripped (suspicious)
            const hasBasicMetadata = result.metadata.dateTime ||
                result.metadata.cameraMake ||
                result.metadata.gpsLatitude;

            if (!hasBasicMetadata) {
                result.fraudIndicators.push('Image metadata stripped - possible attempt to hide origin');
                result.fraudScore += 15;
            }

        } catch (error) {
            // Some images don't have EXIF data (e.g., screenshots)
            result.fraudIndicators.push('No EXIF metadata found - possibly a screenshot or web image');
            result.fraudScore += 10;
        }

        return result;
    },

    /**
     * Analyze image quality metrics
     */
    analyzeImageQuality: async (imageBuffer) => {
        const result = {
            quality: {},
            fraudIndicators: [],
            fraudScore: 0
        };

        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            const stats = await image.stats();

            result.quality = {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                hasAlpha: metadata.hasAlpha,
                density: metadata.density || 72,
                isProgressive: metadata.isProgressive || false
            };

            // Calculate sharpness indicator (entropy of Laplacian)
            const grayscale = await image.grayscale().raw().toBuffer();
            const sharpnessScore = calculateSharpness(grayscale, metadata.width, metadata.height);
            result.quality.sharpness = sharpnessScore;

            // Calculate contrast from stats
            const avgContrast = stats.channels.reduce((sum, c) => sum + (c.max - c.min), 0) / stats.channels.length;
            result.quality.contrast = avgContrast;

            // Check resolution (very low resolution is suspicious)
            const totalPixels = metadata.width * metadata.height;
            if (totalPixels < 100000) { // Less than ~316x316
                result.fraudIndicators.push('Very low resolution image - possibly screenshot of screenshot');
                result.fraudScore += 15;
            } else if (totalPixels < 500000) { // Less than ~707x707
                result.fraudIndicators.push('Low resolution image');
                result.fraudScore += 5;
            }

            // Check for blur
            if (sharpnessScore < 10) {
                result.fraudIndicators.push('Image appears blurry - may obscure details');
                result.fraudScore += 10;
            }

            // Check for very low contrast (might be manipulated)
            if (avgContrast < 50) {
                result.fraudIndicators.push('Unusually low image contrast');
                result.fraudScore += 5;
            }

            // Detect if image has been heavily compressed (JPEG artifacts)
            if (metadata.format === 'jpeg') {
                const compressionCheck = await detectJpegArtifacts(imageBuffer);
                if (compressionCheck.heavilyCompressed) {
                    result.fraudIndicators.push('Image shows signs of multiple compressions');
                    result.fraudScore += 10;
                }
            }

        } catch (error) {
            console.error('Quality analysis error:', error);
        }

        return result;
    },

    /**
     * Detect if image has been edited/photoshopped
     */
    detectImageEditing: async (imageBuffer) => {
        const result = {
            editingDetected: false,
            fraudIndicators: [],
            fraudScore: 0,
            analysisDetails: {}
        };

        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            const stats = await image.stats();

            // Check for inconsistent lighting (analyze brightness variance across regions)
            const lightingAnalysis = await analyzeLighting(imageBuffer);
            result.analysisDetails.lighting = lightingAnalysis;

            if (lightingAnalysis.inconsistent) {
                result.fraudIndicators.push('Inconsistent lighting detected - possible image manipulation');
                result.fraudScore += 15;
                result.editingDetected = true;
            }

            // Check for clone/copy-paste artifacts using Error Level Analysis simulation
            const elaResult = await performELASimulation(imageBuffer);
            result.analysisDetails.ela = elaResult;

            if (elaResult.manipulationDetected) {
                result.fraudIndicators.push('Potential image manipulation detected (ELA analysis)');
                result.fraudScore += 20;
                result.editingDetected = true;
            }

            // Check for suspicious aspect ratios (common in cropped stock photos)
            const aspectRatio = metadata.width / metadata.height;
            const commonStockRatios = [1.0, 1.5, 1.778, 2.0]; // 1:1, 3:2, 16:9, 2:1
            const isCommonRatio = commonStockRatios.some(r => Math.abs(aspectRatio - r) < 0.01);

            if (isCommonRatio && metadata.width >= 1920) {
                result.analysisDetails.possibleStockPhoto = true;
                result.fraudIndicators.push('Image dimensions match common stock photo formats');
                result.fraudScore += 10;
            }

        } catch (error) {
            console.error('Edit detection error:', error);
        }

        return result;
    },

    /**
     * Calculate perceptual hash for duplicate detection
     */
    calculatePerceptualHash: async (imageBuffer, claimIdentifier = null) => {
        const result = {
            duplicateCheck: {},
            fraudIndicators: [],
            fraudScore: 0
        };

        try {
            // Save buffer temporarily for imghash
            const tempPath = path.join(require('os').tmpdir(), `temp_${Date.now()}.jpg`);
            await fs.writeFile(tempPath, imageBuffer);

            // Calculate perceptual hash
            const hash = await imghash.hash(tempPath, 16); // 16-bit hash
            result.duplicateCheck.hash = hash;

            // Clean up temp file
            await fs.unlink(tempPath).catch(() => { });

            // Check against stored hashes for duplicates
            const duplicates = [];
            for (const [storedClaim, storedHashes] of hashStore.entries()) {
                if (storedClaim !== claimIdentifier) {
                    for (const storedHash of storedHashes) {
                        const distance = hammingDistance(hash, storedHash);
                        if (distance < 5) { // Very similar images
                            duplicates.push({
                                claimId: storedClaim,
                                similarity: 100 - (distance * 6.25) // Convert to percentage
                            });
                        }
                    }
                }
            }

            result.duplicateCheck.duplicatesFound = duplicates.length > 0;
            result.duplicateCheck.duplicates = duplicates;

            if (duplicates.length > 0) {
                result.fraudIndicators.push(`Image matches photos from ${duplicates.length} other claim(s)`);
                result.fraudScore += 30;
            }

            // Store hash for future comparisons
            if (claimIdentifier) {
                if (!hashStore.has(claimIdentifier)) {
                    hashStore.set(claimIdentifier, []);
                }
                hashStore.get(claimIdentifier).push(hash);
            }

            // Also calculate a simpler hash for quick comparison
            const simpleHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
            result.duplicateCheck.md5 = simpleHash;

        } catch (error) {
            console.error('Hash calculation error:', error);
        }

        return result;
    },

    /**
     * Detect objects in image (simplified without TensorFlow)
     * Uses color and pattern analysis as a proxy
     */
    detectObjects: async (imageBuffer) => {
        const result = {
            objects: [],
            analysisMethod: 'color-pattern-analysis'
        };

        try {
            const image = sharp(imageBuffer);
            const stats = await image.stats();
            const { dominant } = await image.stats();

            // Analyze dominant colors to infer content type
            const avgRed = stats.channels[0]?.mean || 0;
            const avgGreen = stats.channels[1]?.mean || 0;
            const avgBlue = stats.channels[2]?.mean || 0;

            // Simple heuristics for object detection
            // Blue sky / outdoor scenes
            if (avgBlue > avgRed && avgBlue > avgGreen && avgBlue > 150) {
                result.objects.push({ label: 'outdoor_scene', confidence: 0.6 });
            }

            // Green vegetation (outdoor)
            if (avgGreen > avgRed && avgGreen > avgBlue) {
                result.objects.push({ label: 'vegetation', confidence: 0.5 });
            }

            // Gray/metallic (possibly vehicle)
            if (Math.abs(avgRed - avgGreen) < 20 && Math.abs(avgGreen - avgBlue) < 20) {
                if (avgRed > 80 && avgRed < 180) {
                    result.objects.push({ label: 'vehicle', confidence: 0.4 });
                }
            }

            // Browns and earth tones (building/interior)
            if (avgRed > avgBlue && avgGreen > avgBlue && avgRed > 100) {
                result.objects.push({ label: 'building_interior', confidence: 0.4 });
            }

            // Check for presence of damage indicators (dark spots, red/orange for fire)
            if (avgRed > 200 && avgGreen < 150 && avgBlue < 150) {
                result.objects.push({ label: 'fire_damage', confidence: 0.5 });
            }

            // Water damage (blue tones with brown)
            if (avgBlue > 120 && avgRed > 80) {
                result.objects.push({ label: 'water_damage', confidence: 0.3 });
            }

            // Analyze edge density for structural damage
            const edgeAnalysis = await analyzeEdges(imageBuffer);
            if (edgeAnalysis.highEdgeDensity) {
                result.objects.push({ label: 'structural_damage', confidence: 0.5 });
            }

        } catch (error) {
            console.error('Object detection error:', error);
        }

        return result;
    },

    /**
     * Verify that detected objects match the claim type
     */
    verifyClaimType: (detectedObjects, claimType) => {
        const result = {
            matches: false,
            fraudIndicators: [],
            fraudScore: 0,
            analysis: {}
        };

        if (!claimType || !detectedObjects || detectedObjects.length === 0) {
            return result;
        }

        const claimTypeLower = claimType.toLowerCase();
        const objectLabels = detectedObjects.map(o => o.label.toLowerCase());

        // Define expected objects for each claim type
        const expectedObjects = {
            'auto': ['vehicle', 'car', 'automobile', 'outdoor_scene', 'structural_damage'],
            'home': ['building_interior', 'house', 'building', 'fire_damage', 'water_damage', 'structural_damage'],
            'health': ['medical', 'hospital', 'document', 'person']
        };

        const expected = expectedObjects[claimTypeLower] || [];
        const matches = objectLabels.filter(l =>
            expected.some(e => l.includes(e) || e.includes(l))
        );

        result.analysis.expected = expected;
        result.analysis.detected = objectLabels;
        result.analysis.matches = matches;

        if (matches.length > 0) {
            result.matches = true;
        } else if (detectedObjects.length > 0) {
            // We detected objects but none match the claim type
            result.fraudIndicators.push(`Image content doesn't appear to match ${claimType} claim type`);
            result.fraudScore += 15;
        }

        return result;
    },

    /**
     * Verify image date against incident date
     */
    verifyImageDate: (imageDate, incidentDate) => {
        const result = {
            fraudIndicators: [],
            fraudScore: 0
        };

        try {
            const imgDate = new Date(imageDate);
            const incDate = new Date(incidentDate);
            const diffDays = Math.floor((imgDate - incDate) / (1000 * 60 * 60 * 24));

            if (diffDays < -30) {
                // Image is more than 30 days before incident
                result.fraudIndicators.push(`Photo was taken ${Math.abs(diffDays)} days before claimed incident`);
                result.fraudScore += 25;
            } else if (diffDays < -7) {
                // Image is 7-30 days before incident
                result.fraudIndicators.push(`Photo was taken ${Math.abs(diffDays)} days before claimed incident`);
                result.fraudScore += 15;
            } else if (diffDays > 30) {
                // Image is more than 30 days after incident (less suspicious but worth noting)
                result.fraudIndicators.push(`Photo was taken ${diffDays} days after claimed incident`);
                result.fraudScore += 5;
            }

        } catch (error) {
            console.error('Date verification error:', error);
        }

        return result;
    },

    /**
     * Simulate reverse image search (stock photo detection)
     * In production, integrate with TinEye or Google Vision API
     */
    detectStockPhoto: async (imageBuffer) => {
        const result = {
            isStockPhoto: false,
            confidence: 0,
            fraudIndicators: [],
            fraudScore: 0
        };

        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            // Heuristics for stock photo detection
            // 1. Perfect resolution (common stock sizes)
            const stockResolutions = [
                [1920, 1080], [1280, 720], [3840, 2160], [4000, 6000],
                [6000, 4000], [5000, 3333], [4500, 3000]
            ];

            const isStockResolution = stockResolutions.some(([w, h]) =>
                (metadata.width === w && metadata.height === h) ||
                (metadata.width === h && metadata.height === w)
            );

            if (isStockResolution) {
                result.isStockPhoto = true;
                result.confidence += 30;
                result.fraudIndicators.push('Image resolution matches common stock photo dimensions');
            }

            // 2. Check for watermark removal artifacts
            const watermarkCheck = await detectWatermarkRemoval(imageBuffer);
            if (watermarkCheck.detected) {
                result.isStockPhoto = true;
                result.confidence += 40;
                result.fraudIndicators.push('Possible watermark removal detected');
                result.fraudScore += 25;
            }

            // 3. Too perfect / professional quality
            const stats = await image.stats();
            const avgBrightness = stats.channels.reduce((sum, c) => sum + c.mean, 0) / stats.channels.length;
            const isWellLit = avgBrightness > 100 && avgBrightness < 170;

            // Stock photos typically have very consistent exposure
            const exposureVariance = stats.channels.reduce((sum, c) => sum + (c.stdev || 0), 0) / stats.channels.length;
            if (isWellLit && exposureVariance < 40 && metadata.width >= 2000) {
                result.confidence += 20;
            }

            if (result.confidence >= 50) {
                result.isStockPhoto = true;
                result.fraudIndicators.push('Image characteristics suggest it may be a stock photo');
                result.fraudScore += 20;
            }

        } catch (error) {
            console.error('Stock photo detection error:', error);
        }

        return result;
    }
};

// Helper functions

function calculateSharpness(buffer, width, height) {
    // Simplified Laplacian variance calculation
    let sum = 0;
    let sumSq = 0;
    const len = buffer.length;

    for (let i = 0; i < len; i++) {
        sum += buffer[i];
        sumSq += buffer[i] * buffer[i];
    }

    const mean = sum / len;
    const variance = (sumSq / len) - (mean * mean);
    return Math.sqrt(variance);
}

async function detectJpegArtifacts(imageBuffer) {
    try {
        const image = sharp(imageBuffer);

        // Re-compress at high quality and compare
        const recompressed = await image
            .jpeg({ quality: 95 })
            .toBuffer();

        const sizeRatio = recompressed.length / imageBuffer.length;

        // If recompressing at high quality significantly increases size,
        // the original was heavily compressed
        return {
            heavilyCompressed: sizeRatio > 1.5,
            compressionRatio: sizeRatio
        };
    } catch (error) {
        return { heavilyCompressed: false };
    }
}

async function analyzeLighting(imageBuffer) {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        // Divide image into 9 regions and analyze brightness
        const regionSize = Math.floor(Math.min(metadata.width, metadata.height) / 3);
        const regions = [];

        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const region = await image
                    .extract({
                        left: x * regionSize,
                        top: y * regionSize,
                        width: regionSize,
                        height: regionSize
                    })
                    .stats();

                const brightness = region.channels.reduce((sum, c) => sum + c.mean, 0) / region.channels.length;
                regions.push(brightness);
            }
        }

        // Calculate variance in regional brightness
        const avgBrightness = regions.reduce((a, b) => a + b, 0) / regions.length;
        const variance = regions.reduce((sum, r) => sum + Math.pow(r - avgBrightness, 2), 0) / regions.length;

        // High variance might indicate manipulation (but also legitimate shadows)
        return {
            inconsistent: variance > 2000, // Threshold for suspicious variance
            variance,
            regions
        };
    } catch (error) {
        return { inconsistent: false };
    }
}

async function performELASimulation(imageBuffer) {
    try {
        const image = sharp(imageBuffer);

        // Recompress at lower quality
        const lowQuality = await sharp(imageBuffer)
            .jpeg({ quality: 70 })
            .toBuffer();

        // Compare file sizes as a proxy for ELA
        // Manipulated regions typically compress differently
        const originalStats = await sharp(imageBuffer).stats();
        const compressedStats = await sharp(lowQuality).stats();

        // Compare channel statistics
        let totalDiff = 0;
        for (let i = 0; i < Math.min(originalStats.channels.length, compressedStats.channels.length); i++) {
            totalDiff += Math.abs(originalStats.channels[i].mean - compressedStats.channels[i].mean);
        }

        return {
            manipulationDetected: totalDiff > 30, // Threshold
            compressionDifference: totalDiff
        };
    } catch (error) {
        return { manipulationDetected: false };
    }
}

async function analyzeEdges(imageBuffer) {
    try {
        // Use sharp's built-in edge detection via convolution
        const edgeBuffer = await sharp(imageBuffer)
            .grayscale()
            .convolve({
                width: 3,
                height: 3,
                kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Laplacian
            })
            .raw()
            .toBuffer();

        // Calculate edge density
        let edgePixels = 0;
        for (let i = 0; i < edgeBuffer.length; i++) {
            if (edgeBuffer[i] > 50) edgePixels++;
        }

        const edgeDensity = edgePixels / edgeBuffer.length;

        return {
            highEdgeDensity: edgeDensity > 0.15,
            edgeDensity
        };
    } catch (error) {
        return { highEdgeDensity: false };
    }
}

async function detectWatermarkRemoval(imageBuffer) {
    try {
        const image = sharp(imageBuffer);
        const stats = await image.stats();

        // Look for unusual patterns in specific areas (corners, center-bottom)
        // where watermarks typically appear
        const metadata = await image.metadata();

        // Check center-bottom region
        const bottomRegion = await image
            .extract({
                left: Math.floor(metadata.width * 0.3),
                top: Math.floor(metadata.height * 0.85),
                width: Math.floor(metadata.width * 0.4),
                height: Math.floor(metadata.height * 0.1)
            })
            .stats();

        // Unusual uniformity in watermark area might indicate removal
        const regionVariance = bottomRegion.channels.reduce((sum, c) => sum + (c.stdev || 0), 0);

        return {
            detected: regionVariance < 10, // Very uniform = suspicious
            variance: regionVariance
        };
    } catch (error) {
        return { detected: false };
    }
}

function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

function findInternalDuplicates(hashes) {
    const duplicates = [];
    for (let i = 0; i < hashes.length; i++) {
        for (let j = i + 1; j < hashes.length; j++) {
            if (hammingDistance(hashes[i], hashes[j]) < 3) {
                duplicates.push([i, j]);
            }
        }
    }
    return duplicates;
}

function calculateConfidence(results) {
    // Base confidence on analysis completeness
    let confidence = 50;

    if (results.metadata?.dateTime) confidence += 10;
    if (results.metadata?.cameraMake) confidence += 5;
    if (results.quality?.width) confidence += 10;
    if (results.duplicateCheck?.hash) confidence += 15;
    if (results.detectedObjects?.length > 0) confidence += 10;

    return Math.min(confidence, 100);
}

function getRiskLevel(score) {
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

module.exports = imageAnalysis;
