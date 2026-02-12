import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, ArrowLeft, CheckCircle, Loader2, FileText, Camera, Car, Home, Heart, Plane, Briefcase, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { submitClaim, type SubmitClaimResponse } from "@/lib/api";
import type { ClaimType } from "@/types/claim";
import FraudScore from "@/components/FraudScore";
import StatusBadge from "@/components/StatusBadge";
import AIDecision from "@/components/AIDecision";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Document requirements per claim type
const CLAIM_DOCUMENT_REQUIREMENTS: Record<ClaimType, { required: string[]; optional: string[]; photos: string }> = {
  Auto: {
    required: ["Police Report (if applicable)", "Driver's License", "Vehicle Registration"],
    optional: ["Repair Estimates", "Witness Statements", "Dashcam Footage"],
    photos: "Photos of vehicle damage from multiple angles",
  },
  Home: {
    required: ["Proof of Ownership/Lease", "Insurance Policy Document"],
    optional: ["Contractor Estimates", "Inventory of Damaged Items", "Previous Home Inspection"],
    photos: "Photos of property damage, affected areas",
  },
  Health: {
    required: ["Medical Records", "Doctor's Statement", "Hospital Bills"],
    optional: ["Prescription Records", "Lab Results", "Referral Letters"],
    photos: "Medical imaging (if applicable)",
  },
  Life: {
    required: ["Death Certificate", "Policy Document", "Beneficiary Identification"],
    optional: ["Autopsy Report", "Medical History", "Funeral Expenses"],
    photos: "Certified copies of legal documents",
  },
  Travel: {
    required: ["Travel Itinerary", "Booking Confirmations", "Passport Copy"],
    optional: ["Cancellation Notices", "Medical Reports (if illness)", "Lost Baggage Report"],
    photos: "Photos of damaged luggage or receipts",
  },
  Property: {
    required: ["Property Deed", "Insurance Policy", "Proof of Value"],
    optional: ["Appraisal Reports", "Purchase Receipts", "Maintenance Records"],
    photos: "Photos of damaged property from multiple angles",
  },
};

const CLAIM_TYPE_ICONS: Record<ClaimType, React.ReactNode> = {
  Auto: <Car className="h-4 w-4" />,
  Home: <Home className="h-4 w-4" />,
  Health: <Heart className="h-4 w-4" />,
  Life: <Briefcase className="h-4 w-4" />,
  Travel: <Plane className="h-4 w-4" />,
  Property: <Home className="h-4 w-4" />,
};

const ClaimSubmission = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitClaimResponse | null>(null);
  const [formData, setFormData] = useState({
    policyNumber: "",
    claimantName: "",
    claimantEmail: "",
    claimType: "" as ClaimType | "",
    incidentDate: "",
    claimAmount: "",
    description: "",
  });
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.policyNumber || !formData.claimantName || !formData.claimType || !formData.claimAmount) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await submitClaim(formData, policyFile, damagePhotos);
      setSubmissionResult(result);
      setSubmitted(true);
      toast({ title: "Claim Submitted", description: "Your claim has been processed by AI." });
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit claim. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl px-4"
        >
          <div className="text-center mb-8">
            <div className="mb-6 inline-flex rounded-full bg-success/10 p-4">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Claim Submitted Successfully</h2>
            <p className="mt-2 text-muted-foreground">Your claim has been analyzed by our AI system.</p>
          </div>

          {submissionResult?.claim && (
            <div className="mt-8 w-full max-w-2xl space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 card-shadow text-left space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <span className="text-sm text-muted-foreground">Claim ID</span>
                  <span className="font-mono font-semibold text-foreground">{submissionResult.claim.id}</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={submissionResult.claim.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fraud Score</span>
                  <FraudScore score={submissionResult.claim.fraudScore} />
                </div>
              </div>

              {submissionResult.claim.aiAnalysis && (
                <AIDecision
                  recommendation={submissionResult.claim.aiAnalysis.recommendation}
                  status={submissionResult.claim.status}
                  fraudScore={submissionResult.claim.fraudScore}
                />
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Button onClick={() => navigate("/dashboard")} className="bg-primary text-primary-foreground hover:bg-primary/90">
              View Dashboard
            </Button>
            <Button variant="outline" onClick={() => { setSubmitted(false); setSubmissionResult(null); setFormData({ policyNumber: "", claimantName: "", claimantEmail: "", claimType: "", incidentDate: "", claimAmount: "", description: "" }); setPolicyFile(null); setDamagePhotos([]); }}>
              Submit Another
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>

      <div className="container max-w-2xl py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl font-bold text-foreground">Submit a Claim</h1>
          <p className="mt-2 text-muted-foreground">Fill in the details below. Our AI will analyze your claim automatically.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {/* Policy & Claimant */}
            <div className="rounded-xl border border-border bg-card p-6 card-shadow space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Policy Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="policyNumber">Policy Number *</Label>
                  <Input id="policyNumber" placeholder="POL-XXXXXXX" className="mt-1.5 bg-secondary border-border" value={formData.policyNumber} onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="claimantName">Claimant Name *</Label>
                  <Input id="claimantName" placeholder="Full name" className="mt-1.5 bg-secondary border-border" value={formData.claimantName} onChange={(e) => setFormData({ ...formData, claimantName: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="claimantEmail">Email</Label>
                <Input id="claimantEmail" type="email" placeholder="email@example.com" className="mt-1.5 bg-secondary border-border" value={formData.claimantEmail} onChange={(e) => setFormData({ ...formData, claimantEmail: e.target.value })} />
              </div>
            </div>

            {/* Claim Details */}
            <div className="rounded-xl border border-border bg-card p-6 card-shadow space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Claim Details</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Claim Type *</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, claimType: v as ClaimType })}>
                    <SelectTrigger className="mt-1.5 bg-secondary border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto">
                        <span className="flex items-center gap-2"><Car className="h-4 w-4" /> Auto</span>
                      </SelectItem>
                      <SelectItem value="Home">
                        <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Home</span>
                      </SelectItem>
                      <SelectItem value="Health">
                        <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Health</span>
                      </SelectItem>
                      <SelectItem value="Life">
                        <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> Life</span>
                      </SelectItem>
                      <SelectItem value="Travel">
                        <span className="flex items-center gap-2"><Plane className="h-4 w-4" /> Travel</span>
                      </SelectItem>
                      <SelectItem value="Property">
                        <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Property</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="incidentDate">Incident Date</Label>
                  <Input id="incidentDate" type="date" className="mt-1.5 bg-secondary border-border" value={formData.incidentDate} onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="claimAmount">Amount ($) *</Label>
                  <Input id="claimAmount" type="number" placeholder="0.00" className="mt-1.5 bg-secondary border-border" value={formData.claimAmount} onChange={(e) => setFormData({ ...formData, claimAmount: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Describe the incident in detail..." className="mt-1.5 min-h-[120px] bg-secondary border-border" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>

            {/* Document Requirements - Shows based on claim type */}
            {formData.claimType && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl border border-primary/30 bg-primary/5 p-6 card-shadow space-y-4"
              >
                <div className="flex items-center gap-2">
                  {CLAIM_TYPE_ICONS[formData.claimType]}
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    {formData.claimType} Claim Requirements
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-destructive" /> Required Documents
                    </h4>
                    <ul className="space-y-1">
                      {CLAIM_DOCUMENT_REQUIREMENTS[formData.claimType].required.map((doc, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                      <FileText className="h-4 w-4 text-muted-foreground" /> Optional Documents
                    </h4>
                    <ul className="space-y-1">
                      {CLAIM_DOCUMENT_REQUIREMENTS[formData.claimType].optional.map((doc, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-1">
                    <Camera className="h-4 w-4 text-primary" /> Photo Requirements
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {CLAIM_DOCUMENT_REQUIREMENTS[formData.claimType].photos}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Uploads */}
            <div className="rounded-xl border border-border bg-card p-6 card-shadow space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h3>
              <div>
                <Label>Policy Document (PDF)</Label>
                <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary p-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Upload className="h-5 w-5" />
                  {policyFile ? policyFile.name : "Click to upload policy document"}
                  <input type="file" accept=".pdf" className="hidden" onChange={(e) => setPolicyFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div>
                <Label>Damage Photos</Label>
                <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary p-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Upload className="h-5 w-5" />
                  {damagePhotos.length > 0 ? `${damagePhotos.length} file(s) selected` : "Click to upload photos"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setDamagePhotos(Array.from(e.target.files || []))} />
                </label>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Claim for AI Analysis"
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default ClaimSubmission;
