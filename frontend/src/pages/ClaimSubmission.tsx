import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
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
      <div className="flex min-h-[80vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="mb-6 inline-flex rounded-full bg-success/10 p-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Claim Submitted Successfully</h2>
          <p className="mt-2 text-muted-foreground">Your claim has been analyzed by our AI system.</p>

          {submissionResult?.claim && (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 card-shadow text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Claim ID</span>
                <span className="font-mono font-semibold text-foreground">{submissionResult.claim.id}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={submissionResult.claim.status} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Fraud Score</span>
                <FraudScore score={submissionResult.claim.fraudScore} />
              </div>
              {submissionResult.claim.aiAnalysis && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">AI Decision</p>
                  <p className="text-sm text-foreground">{submissionResult.claim.aiAnalysis.recommendation}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-4">
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
                      <SelectItem value="Auto">Auto</SelectItem>
                      <SelectItem value="Home">Home</SelectItem>
                      <SelectItem value="Health">Health</SelectItem>
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
