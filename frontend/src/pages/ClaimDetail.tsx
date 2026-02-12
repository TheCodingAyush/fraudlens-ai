import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, FileText, Image as ImageIcon, Shield, Loader2, RefreshCw, X, ThumbsUp, ThumbsDown, MessageSquare, ArrowUpCircle, History } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClaimById, approveClaim, rejectClaim, requestMoreInfo, escalateClaim, fetchClaimHistory, ClaimHistoryEntry } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import FraudScore from "@/components/FraudScore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ClaimDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Action dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Form states
  const [approveNotes, setApproveNotes] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [requestedDocs, setRequestedDocs] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [escalatePriority, setEscalatePriority] = useState<"low" | "medium" | "high">("high");

  const { data: claim, isLoading, error, refetch } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => fetchClaimById(id!),
    enabled: !!id,
  });

  const { data: historyData } = useQuery({
    queryKey: ["claimHistory", id],
    queryFn: () => fetchClaimHistory(id!),
    enabled: !!id && historyDialogOpen,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: () => approveClaim(id!, {
      approvedAmount: approvedAmount ? parseFloat(approvedAmount) : undefined,
      notes: approveNotes,
    }),
    onSuccess: () => {
      toast({ title: "Claim Approved", description: "The claim has been approved successfully." });
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      setApproveDialogOpen(false);
      setApproveNotes("");
      setApprovedAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectClaim(id!, {
      rejectionReason: rejectReason,
      notes: rejectNotes,
    }),
    onSuccess: () => {
      toast({ title: "Claim Rejected", description: "The claim has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setRejectNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const infoMutation = useMutation({
    mutationFn: () => requestMoreInfo(id!, {
      message: infoMessage,
      requestedDocuments: requestedDocs.split(",").map(d => d.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast({ title: "Information Requested", description: "Request sent to claimant." });
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      setInfoDialogOpen(false);
      setInfoMessage("");
      setRequestedDocs("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () => escalateClaim(id!, {
      reason: escalateReason,
      priority: escalatePriority,
    }),
    onSuccess: () => {
      toast({ title: "Claim Escalated", description: "The claim has been escalated for manual review." });
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      setEscalateDialogOpen(false);
      setEscalateReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading claim details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {error instanceof Error && error.message === "Claim not found" ? "Claim Not Found" : "Failed to load claim"}
          </h2>
          <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : "An error occurred"}</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Claim Not Found</h2>
          <Link to="/dashboard" className="mt-4 inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = claim.status === "Approved" || claim.status === "approved"
    ? CheckCircle
    : claim.status === "Flagged" || claim.status === "rejected"
      ? AlertTriangle
      : Clock;

  const canTakeAction = !["approved", "rejected"].includes(claim.status?.toLowerCase());

  const formatHistoryAction = (entry: ClaimHistoryEntry) => {
    const actionLabels: Record<string, string> = {
      submitted: "Claim Submitted",
      approved: "Approved",
      rejected: "Rejected",
      info_requested: "More Info Requested",
      escalated: "Escalated for Review",
    };
    return actionLabels[entry.action] || entry.action;
  };

  return (
    <>
      <div className="container max-w-4xl py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-mono text-foreground">{claim.id}</h1>
                <StatusBadge status={claim.status} />
              </div>
              <p className="mt-1 text-muted-foreground">Submitted on {claim.submittedAt}</p>
            </div>
            <FraudScore score={claim.fraudScore} size="lg" />
          </div>

          {/* Admin Action Buttons */}
          {canTakeAction && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve Claim</DialogTitle>
                    <DialogDescription>
                      Approve this claim for ${claim.claimAmount?.toLocaleString()}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Approved Amount (optional)</Label>
                      <Input
                        type="number"
                        placeholder={`Default: ${claim.claimAmount}`}
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea
                        placeholder="Add any notes about this approval..."
                        value={approveNotes}
                        onChange={(e) => setApproveNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirm Approval
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <ThumbsDown className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Claim</DialogTitle>
                    <DialogDescription>
                      Please provide a reason for rejecting this claim.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Rejection Reason *</Label>
                      <Select value={rejectReason} onValueChange={setRejectReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fraud_detected">Fraud Detected</SelectItem>
                          <SelectItem value="insufficient_evidence">Insufficient Evidence</SelectItem>
                          <SelectItem value="policy_not_valid">Policy Not Valid</SelectItem>
                          <SelectItem value="claim_not_covered">Claim Not Covered</SelectItem>
                          <SelectItem value="duplicate_claim">Duplicate Claim</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea
                        placeholder="Provide additional details..."
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate()}
                      disabled={rejectMutation.isPending || !rejectReason}
                    >
                      {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirm Rejection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <MessageSquare className="mr-2 h-4 w-4" /> Request Info
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request More Information</DialogTitle>
                    <DialogDescription>
                      Request additional documents or information from the claimant.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Message to Claimant *</Label>
                      <Textarea
                        placeholder="Please provide the following documentation..."
                        value={infoMessage}
                        onChange={(e) => setInfoMessage(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Requested Documents (comma-separated)</Label>
                      <Input
                        placeholder="e.g., Police Report, Medical Records, Repair Estimates"
                        value={requestedDocs}
                        onChange={(e) => setRequestedDocs(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInfoDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => infoMutation.mutate()}
                      disabled={infoMutation.isPending || !infoMessage}
                    >
                      {infoMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <ArrowUpCircle className="mr-2 h-4 w-4" /> Escalate
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Escalate for Manual Review</DialogTitle>
                    <DialogDescription>
                      Escalate this claim to a senior adjuster for review.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Reason for Escalation *</Label>
                      <Textarea
                        placeholder="Describe why this claim needs senior review..."
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority Level</Label>
                      <Select value={escalatePriority} onValueChange={(v) => setEscalatePriority(v as "low" | "medium" | "high")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => escalateMutation.mutate()}
                      disabled={escalateMutation.isPending || !escalateReason}
                    >
                      {escalateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Escalate Claim
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost">
                    <History className="mr-2 h-4 w-4" /> History
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Claim History</DialogTitle>
                    <DialogDescription>
                      Review the status changes for this claim.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    {historyData?.history && historyData.history.length > 0 ? (
                      <div className="space-y-4">
                        {historyData.history.map((entry, index) => (
                          <div key={index} className="flex gap-3 border-l-2 border-primary/30 pl-4 py-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{formatHistoryAction(entry)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                              {entry.reviewerName && (
                                <p className="text-xs text-muted-foreground">By: {entry.reviewerName}</p>
                              )}
                              {entry.notes && (
                                <p className="text-sm mt-1 text-muted-foreground">{entry.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No history available</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Status Message for Completed Claims */}
          {!canTakeAction && (
            <div className={`mt-6 p-4 rounded-lg ${claim.status?.toLowerCase() === 'approved' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-center gap-2">
                {claim.status?.toLowerCase() === 'approved' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <X className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  This claim has been {claim.status?.toLowerCase()}.
                </span>
              </div>
              {claim.reviewedAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  Reviewed on {new Date(claim.reviewedAt).toLocaleDateString()} by {claim.reviewerName || 'Admin'}
                </p>
              )}
            </div>
          )}

          {/* Claim Info */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 card-shadow">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Claim Information</h3>
              <dl className="space-y-3">
                {[
                  ["Policy Number", claim.policyNumber],
                  ["Claimant", claim.claimantName],
                  ["Email", claim.claimantEmail],
                  ["Claim Type", claim.claimType],
                  ["Incident Date", claim.incidentDate],
                  ["Amount", `$${claim.claimAmount?.toLocaleString()}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium text-foreground text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 card-shadow">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <p className="text-sm leading-relaxed text-foreground">{claim.description}</p>

              <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h3>
              <div className="space-y-2">
                {claim.files?.policyDocument ? (
                  <a
                    href={claim.files.policyDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span>View Policy Document</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>No policy document</span>
                  </div>
                )}
              </div>

              {/* Image Gallery */}
              {claim.files?.damagePhotos && claim.files.damagePhotos.length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Damage Photos ({claim.files.damagePhotos.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {claim.files.damagePhotos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(photo)}
                        className="aspect-square rounded-lg overflow-hidden bg-secondary hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <img
                          src={photo}
                          alt={`Damage photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(!claim.files?.damagePhotos || claim.files.damagePhotos.length === 0) && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <span>No damage photos</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-card p-6 card-shadow glow">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">AI Analysis</h3>
                <p className="text-xs text-muted-foreground">
                  Confidence: <span className="font-mono font-semibold text-primary">{claim.aiAnalysis?.confidence}%</span>
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground">{claim.aiAnalysis?.summary}</p>

            <div className="mt-4 rounded-lg bg-secondary p-4">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${claim.status === "Approved" || claim.status === "approved" ? "text-success" : claim.status === "Flagged" || claim.status === "rejected" ? "text-flagged" : "text-warning"}`} />
                <span className="text-sm font-semibold text-foreground">Recommendation</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{claim.aiAnalysis?.recommendation}</p>
            </div>

            {claim.aiAnalysis?.riskFactors && claim.aiAnalysis.riskFactors.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-flagged">
                  <AlertTriangle className="h-4 w-4" /> Risk Factors
                </h4>
                <ul className="space-y-1.5">
                  {claim.aiAnalysis.riskFactors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-flagged" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={selectedImage}
            alt="Full size damage photo"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ClaimDetail;
