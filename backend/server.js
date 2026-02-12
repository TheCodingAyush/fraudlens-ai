const express = require('express');
const cors = require('cors');
require('dotenv').config();

const claimsRoutes = require('./routes/claims');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/claims', claimsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'FraudLens AI Backend Running', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`🚀 FraudLens AI Backend running on port ${PORT}`);
});