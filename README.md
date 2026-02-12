# FraudLens AI

AI-powered insurance claim fraud detection system with image analysis, OCR document processing, and real-time fraud scoring.

## Features

- **Claim Submission** - Submit insurance claims with documents and damage photos
- **AI Fraud Detection** - Automatic fraud scoring based on claim data patterns
- **Image Analysis** - Detect manipulated photos, duplicates, and verify claim type
- **OCR Processing** - Extract data from PDFs (policy documents, repair estimates, medical bills, police reports)
- **Document Authenticity** - Detect forged documents, inconsistent fonts, and date mismatches
- **Real-time Dashboard** - View all claims with status badges and fraud scores

## Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- TanStack Query

**Backend:**
- Node.js + Express
- Firebase/Firestore
- Tesseract.js (OCR)
- Sharp (Image processing)
- pdf-parse (PDF extraction)

## Setup

### Prerequisites
- Node.js 18+
- Firebase project with Firestore enabled

### 1. Clone the repository
```bash
git clone https://github.com/TheCodingAyush/fraudlens-ai.git
cd fraudlens-ai
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env

# Copy Firebase service account template
cp config/serviceAccountKey.example.json config/serviceAccountKey.json
# Edit serviceAccountKey.json with your Firebase credentials
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
node server.js
```
Backend runs on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:8080

## Usage

1. Open http://localhost:8080
2. Click "Submit a Claim"
3. Fill in claim details:
   - Policy Number: `POL-2024-789456`
   - Claimant Name: `John Smith`
   - Email: `john.smith@email.com`
   - Claim Type: `Auto`
   - Amount: `15000`
   - Description: Describe the incident
4. Upload policy document (PDF) and damage photos
5. Submit and view fraud analysis results

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/claims/submit` | Submit new claim |
| GET | `/api/claims` | Get all claims |
| GET | `/api/claims/:id` | Get claim details |

## Fraud Detection Rules

- High claim amounts (>$50k)
- Same-day incident submissions
- Vague descriptions
- Round number amounts
- Policy number mismatches
- Suspicious keywords
- Image manipulation detection
- Duplicate photo detection
- Document authenticity checks

## License

MIT

## Author

Ayush Sonone
