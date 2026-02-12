import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, FileText, Image as ImageIcon, Shield, Loader2, RefreshCw, X } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchClaimById } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import FraudScore from "@/components/FraudScore";
import { Button } from "@/components/ui/button";

const ClaimDetail = () => {
  const { id } = useParams();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: claim, isLoading, error, refetch } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => fetchClaimById(id!),
    enabled: !!id,
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

  const StatusIcon = claim.status === "Approved" ? CheckCircle : claim.status === "Flagged" ? AlertTriangle : Clock;

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
                  ["Amount", `$${claim.claimAmount.toLocaleString()}`],
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
                  Confidence: <span className="font-mono font-semibold text-primary">{claim.aiAnalysis.confidence}%</span>
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground">{claim.aiAnalysis.summary}</p>

            <div className="mt-4 rounded-lg bg-secondary p-4">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${claim.status === "Approved" ? "text-success" : claim.status === "Flagged" ? "text-flagged" : "text-warning"}`} />
                <span className="text-sm font-semibold text-foreground">Recommendation</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{claim.aiAnalysis.recommendation}</p>
            </div>

            {claim.aiAnalysis.riskFactors.length > 0 && (
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
