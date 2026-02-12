const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const ocrService = require('../services/ocrService');
const fraudDetection = require('../services/fraudDetection');
const decisionEngine = require('../services/decisionEngine');
const documentValidation = require('../services/documentValidation');

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

    // Safely access uploaded files (may be undefined if no files uploaded)
    const files = req.files || {};

    // Convert uploaded files to base64 for storage in Firestore
    const policyDoc = files.policyDocument && files.policyDocument[0]
      ? files.policyDocument[0].buffer.toString('base64')
      : null;
    const photos = files.damagePhotos
      ? files.damagePhotos.map(file => file.buffer.toString('base64'))
      : [];

    // OCR processing on policy document
    let extractedData = {};
    if (policyDoc) {
      try {
        extractedData = await ocrService.extractFromDocument(policyDoc);
      } catch (ocrError) {
        console.warn('OCR processing failed:', ocrError.message);
        extractedData = { error: 'OCR processing failed', rawText: '' };
      }
    }

    // ============== DOCUMENT VALIDATION ==============
    // Validate extracted OCR data against form submission
    let documentValidationResult = null;
    if (policyDoc && extractedData && !extractedData.error) {
      try {
        documentValidationResult = documentValidation.validateDocumentData(
          extractedData,
          {
            policyNumber,
            claimantName,
            claimAmount: parseFloat(claimAmount),
            incidentDate
          }
        );
        console.log('Document validation completed:', {
          isValid: documentValidationResult.isValid,
          fraudScore: documentValidationResult.fraudScore,
          indicators: documentValidationResult.indicators.length
        });
      } catch (validationError) {
        console.warn('Document validation failed:', validationError.message);
        documentValidationResult = {
          error: 'Validation failed',
          fraudScore: 0,
          indicators: [],
          warnings: ['Document validation could not be completed']
        };
      }
    }

    // Get image buffers for fraud detection image analysis
    const imageBuffers = files.damagePhotos
      ? files.damagePhotos.map(file => file.buffer)
      : [];

    // Fraud detection with image analysis and document validation
    const fraudAnalysis = await fraudDetection.analyzeClaim({
      policyNumber,
      claimAmount: parseFloat(claimAmount),
      incidentDate,
      claimType,
      description,
      extractedData,
      documentValidation: documentValidationResult // Pass validation results
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
      extractedData: {
        ...extractedData,
        // Don't store raw text to save space, keep structured data
        rawText: extractedData.rawText ? `[${extractedData.rawText.length} chars]` : ''
      },
      documentValidation: documentValidationResult ? {
        isValid: documentValidationResult.isValid,
        fraudScore: documentValidationResult.fraudScore,
        indicators: documentValidationResult.indicators,
        warnings: documentValidationResult.warnings,
        details: documentValidationResult.details
      } : null,
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
      processedAt: new Date().toISOString(),
      // Initialize status history
      statusHistory: [{
        action: 'submitted',
        timestamp: new Date().toISOString(),
        status: decision.status,
        notes: `AI processed with ${fraudAnalysis.riskLevel} risk level`
      }]
    };

    const claimRef = await db.collection('claims').add(claimData);

    res.status(201).json({
      success: true,
      message: 'Claim processed successfully',
      claim: {
        id: claimRef.id,
        policyNumber,
        claimantName,
        claimantEmail,
        claimType,
        incidentDate,
        claimAmount: parseFloat(claimAmount),
        description,
        status: decision.status,
        fraudScore: fraudAnalysis.fraudScore,
        documentValidation: documentValidationResult ? {
          isValid: documentValidationResult.isValid,
          warnings: documentValidationResult.warnings
        } : null,
        aiAnalysis: {
          recommendation: decision.explanation,
          riskLevel: fraudAnalysis.riskLevel,
          indicators: fraudAnalysis.indicators
        },
        submittedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all claims (for dashboard)
router.get('/', async (req, res) => {
  try {
    const { email } = req.query; // Optional filter by email
    let query = db.collection('claims').orderBy('submittedAt', 'desc').limit(50);

    const snapshot = await query.get();
    const claims = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // If email filter provided, only include matching claims
      if (email && data.claimantEmail?.toLowerCase() !== email.toLowerCase()) {
        return;
      }
      claims.push({
        id: doc.id,
        policyNumber: data.policyNumber,
        claimantName: data.claimantName,
        claimantEmail: data.claimantEmail,
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

// ============== ADMIN ACTIONS ==============

// Approve claim
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName, approvedAmount, notes } = req.body;

    const claimRef = db.collection('claims').doc(id);
    const doc = await claimRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claimData = doc.data();

    // Create history entry
    const historyEntry = {
      action: 'approved',
      timestamp: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      previousStatus: claimData.status,
      notes: notes || '',
      approvedAmount: approvedAmount || claimData.claimAmount
    };

    // Update claim
    await claimRef.update({
      status: 'approved',
      approvedAmount: approvedAmount || claimData.claimAmount,
      reviewedAt: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      reviewNotes: notes || '',
      statusHistory: [...(claimData.statusHistory || []), historyEntry]
    });

    res.json({
      success: true,
      message: 'Claim approved successfully',
      claim: {
        id,
        status: 'approved',
        approvedAmount: approvedAmount || claimData.claimAmount,
        reviewedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject claim
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName, rejectionReason, notes } = req.body;

    const claimRef = db.collection('claims').doc(id);
    const doc = await claimRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claimData = doc.data();

    // Create history entry
    const historyEntry = {
      action: 'rejected',
      timestamp: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      previousStatus: claimData.status,
      rejectionReason: rejectionReason || 'Not specified',
      notes: notes || ''
    };

    // Update claim
    await claimRef.update({
      status: 'rejected',
      rejectionReason: rejectionReason || 'Not specified',
      reviewedAt: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      reviewNotes: notes || '',
      statusHistory: [...(claimData.statusHistory || []), historyEntry]
    });

    res.json({
      success: true,
      message: 'Claim rejected',
      claim: {
        id,
        status: 'rejected',
        rejectionReason: rejectionReason || 'Not specified',
        reviewedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request more information
router.post('/:id/request-info', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName, requestedDocuments, message, deadline } = req.body;

    const claimRef = db.collection('claims').doc(id);
    const doc = await claimRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claimData = doc.data();

    // Create history entry
    const historyEntry = {
      action: 'info_requested',
      timestamp: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      previousStatus: claimData.status,
      requestedDocuments: requestedDocuments || [],
      message: message || ''
    };

    // Calculate deadline (default 7 days)
    const responseDeadline = deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update claim
    await claimRef.update({
      status: 'pending_info',
      infoRequestedAt: new Date().toISOString(),
      infoRequestDeadline: responseDeadline,
      requestedDocuments: requestedDocuments || [],
      infoRequestMessage: message || 'Additional documentation required',
      reviewerName: reviewerName || 'Admin',
      statusHistory: [...(claimData.statusHistory || []), historyEntry]
    });

    res.json({
      success: true,
      message: 'Information request sent',
      claim: {
        id,
        status: 'pending_info',
        requestedDocuments: requestedDocuments || [],
        deadline: responseDeadline
      }
    });
  } catch (error) {
    console.error('Error requesting info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Escalate claim for manual review
router.post('/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName, reason, priority } = req.body;

    const claimRef = db.collection('claims').doc(id);
    const doc = await claimRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claimData = doc.data();

    // Create history entry
    const historyEntry = {
      action: 'escalated',
      timestamp: new Date().toISOString(),
      reviewerName: reviewerName || 'Admin',
      previousStatus: claimData.status,
      reason: reason || 'Requires senior review',
      priority: priority || 'high'
    };

    // Update claim
    await claimRef.update({
      status: 'manual_review',
      escalatedAt: new Date().toISOString(),
      escalationReason: reason || 'Requires senior review',
      escalationPriority: priority || 'high',
      reviewerName: reviewerName || 'Admin',
      statusHistory: [...(claimData.statusHistory || []), historyEntry]
    });

    res.json({
      success: true,
      message: 'Claim escalated for manual review',
      claim: {
        id,
        status: 'manual_review',
        priority: priority || 'high'
      }
    });
  } catch (error) {
    console.error('Error escalating claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get claim status history
router.get('/:id/history', async (req, res) => {
  try {
    const doc = await db.collection('claims').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const data = doc.data();
    const history = data.statusHistory || [];

    // Add initial submission as first entry if no history
    if (history.length === 0 && data.submittedAt) {
      history.unshift({
        action: 'submitted',
        timestamp: data.submittedAt,
        status: data.status
      });
    }

    res.json({
      success: true,
      claimId: req.params.id,
      currentStatus: data.status,
      history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;