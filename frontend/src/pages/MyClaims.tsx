import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, FileText, Clock, CheckCircle, AlertTriangle, MessageSquare, RefreshCw } from "lucide-react";
import { fetchClaims } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import FraudScore from "@/components/FraudScore";
import type { Claim } from "@/types/claim";

const MyClaims = () => {
    const { userProfile } = useAuth();

    // Fetch claims - in a real app, this would filter by user ID
    const { data: claims, isLoading, error, refetch } = useQuery({
        queryKey: ["myClaims", userProfile?.email],
        queryFn: fetchClaims,
    });

    // Filter claims by user's email (demo filtering - in production this would be backend-filtered)
    const myClaims = claims?.filter((claim: Claim) =>
        claim.claimantEmail?.toLowerCase() === userProfile?.email?.toLowerCase()
    ) || [];

    const getStatusIcon = (status: string) => {
        const normalizedStatus = status?.toLowerCase();
        switch (normalizedStatus) {
            case "approved":
                return <CheckCircle className="h-5 w-5 text-success" />;
            case "rejected":
                return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case "pending_info":
                return <MessageSquare className="h-5 w-5 text-blue-500" />;
            case "flagged":
                return <AlertTriangle className="h-5 w-5 text-flagged" />;
            default:
                return <Clock className="h-5 w-5 text-warning" />;
        }
    };

    return (
        <div className="container max-w-4xl py-8">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">My Claims</h1>
                        <p className="mt-1 text-muted-foreground">
                            Welcome back, {userProfile?.displayName || "User"}! Track your submitted claims here.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button asChild>
                            <Link to="/submit">
                                <Plus className="mr-2 h-4 w-4" /> Submit New Claim
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            <p className="mt-4 text-muted-foreground">Loading your claims...</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-foreground">Failed to load claims</p>
                        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "An error occurred"}</p>
                        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && myClaims.length === 0 && (
                    <div className="rounded-xl border border-border bg-card p-12 text-center">
                        <div className="inline-flex rounded-full bg-primary/10 p-4 mb-4">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2">No Claims Yet</h2>
                        <p className="text-muted-foreground mb-6">
                            You haven't submitted any insurance claims yet. Get started by filing your first claim.
                        </p>
                        <Button asChild>
                            <Link to="/submit">
                                <Plus className="mr-2 h-4 w-4" /> Submit Your First Claim
                            </Link>
                        </Button>
                    </div>
                )}

                {/* Claims List */}
                {!isLoading && !error && myClaims.length > 0 && (
                    <div className="space-y-4">
                        {myClaims.map((claim: Claim, index: number) => (
                            <motion.div
                                key={claim.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link
                                    to={`/claim/${claim.id}`}
                                    className="block rounded-xl border border-border bg-card p-6 card-shadow hover:border-primary/30 transition-all"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-lg bg-secondary p-3">
                                                {getStatusIcon(claim.status)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm text-muted-foreground">{claim.id.slice(0, 8)}...</span>
                                                    <StatusBadge status={claim.status} />
                                                </div>
                                                <h3 className="font-semibold text-foreground">{claim.claimType} Claim</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    ${claim.claimAmount?.toLocaleString()} - Submitted {new Date(claim.submittedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {claim.status?.toLowerCase() === "pending_info" && (
                                                <span className="text-sm text-blue-500 font-medium">Action Required</span>
                                            )}
                                            <FraudScore score={claim.fraudScore} />
                                        </div>
                                    </div>

                                    {/* Info Request Banner */}
                                    {claim.status?.toLowerCase() === "pending_info" && (
                                        <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                                            <div className="flex items-center gap-2 text-blue-500">
                                                <MessageSquare className="h-4 w-4" />
                                                <span className="text-sm font-medium">Additional information requested</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Please review and provide the requested documents to continue processing.
                                            </p>
                                        </div>
                                    )}
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Summary Stats */}
                {!isLoading && !error && myClaims.length > 0 && (
                    <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <p className="text-2xl font-bold text-foreground">{myClaims.length}</p>
                            <p className="text-sm text-muted-foreground">Total Claims</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <p className="text-2xl font-bold text-success">
                                {myClaims.filter((c: Claim) => c.status?.toLowerCase() === "approved").length}
                            </p>
                            <p className="text-sm text-muted-foreground">Approved</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <p className="text-2xl font-bold text-warning">
                                {myClaims.filter((c: Claim) => ["pending", "manual_review"].includes(c.status?.toLowerCase())).length}
                            </p>
                            <p className="text-sm text-muted-foreground">Pending</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <p className="text-2xl font-bold text-blue-500">
                                {myClaims.filter((c: Claim) => c.status?.toLowerCase() === "pending_info").length}
                            </p>
                            <p className="text-sm text-muted-foreground">Action Needed</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default MyClaims;
