const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const ocrService = require('../services/ocrService');
const fraudDetection = require('../services/fraudDetection');
const decisionEngine = require('../services/decisionEngine');

// Configure multer here instead
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Submit new claim
router.post('/submit', upload.fields([
  { name: 'policyDocument', maxCount: 1 },
  { name: 'damagePhotos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { policyNumber, claimantName, claimantEmail, claimType, incidentDate, claimAmount, description } = req.body;

    // Convert uploaded files to base64 for storage in Firestore
    const policyDoc = req.files.policyDocument ? req.files.policyDocument[0].buffer.toString('base64') : null;
    const photos = req.files.damagePhotos ? req.files.damagePhotos.map(file => file.buffer.toString('base64')) : [];

    // OCR processing on policy document
    let extractedData = {};
    if (policyDoc) {
      extractedData = await ocrService.extractFromDocument(policyDoc);
    }

    // Get image buffers for fraud detection image analysis
    const imageBuffers = req.files.damagePhotos
      ? req.files.damagePhotos.map(file => file.buffer)
      : [];

    // Fraud detection with image analysis
    const fraudAnalysis = await fraudDetection.analyzeClaim({
      policyNumber,
      claimAmount: parseFloat(claimAmount),
      incidentDate,
      claimType,
      description,
      extractedData
    }, imageBuffers);

    // Decision engine
    const decision = decisionEngine.makeDecision(fraudAnalysis, claimAmount);

    // Save to Firestore
    const claimData = {
      policyNumber,
      claimantName,
      claimantEmail,
      claimType,
      incidentDate,
      claimAmount: parseFloat(claimAmount),
      description,
      policyDocument: policyDoc,
      damagePhotos: photos,
      extractedData,
      fraudScore: fraudAnalysis.fraudScore,
      fraudIndicators: fraudAnalysis.indicators,
      riskLevel: fraudAnalysis.riskLevel,
      imageAnalysis: fraudAnalysis.imageAnalysis ? {
        imageCount: fraudAnalysis.imageAnalysis.imageCount,
        combinedFraudScore: fraudAnalysis.imageAnalysis.combinedFraudScore,
        overallRiskLevel: fraudAnalysis.imageAnalysis.overallRiskLevel,
        combinedIndicators: fraudAnalysis.imageAnalysis.combinedIndicators
      } : null,
      status: decision.status,
      decision: decision.explanation,
      confidence: decision.confidence,
      submittedAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    const claimRef = await db.collection('claims').add(claimData);

    res.status(201).json({
      success: true,
      claimId: claimRef.id,
      status: decision.status,
      fraudScore: fraudAnalysis.fraudScore,
      decision: decision.explanation,
      message: 'Claim processed successfully'
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all claims (for dashboard)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('claims').orderBy('submittedAt', 'desc').limit(50).get();
    const claims = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      claims.push({
        id: doc.id,
        policyNumber: data.policyNumber,
        claimantName: data.claimantName,
        claimType: data.claimType,
        claimAmount: data.claimAmount,
        status: data.status,
        fraudScore: data.fraudScore,
        submittedAt: data.submittedAt
      });
    });

    res.json({ success: true, claims });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single claim details
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('claims').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({ success: true, claim: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;