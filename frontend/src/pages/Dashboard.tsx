import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Car, Home, Heart, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchClaims } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import FraudScore from "@/components/FraudScore";
import { Button } from "@/components/ui/button";

const claimTypeIcon = {
  Auto: Car,
  Home: Home,
  Health: Heart,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: claims = [], isLoading, error, refetch } = useQuery({
    queryKey: ["claims"],
    queryFn: fetchClaims,
  });

  const stats = {
    total: claims.length,
    approved: claims.filter((c) => c.status === "Approved").length,
    pending: claims.filter((c) => c.status === "Pending").length,
    flagged: claims.filter((c) => c.status === "Flagged").length,
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading claims...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Failed to load claims</h2>
          <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : "An error occurred"}</p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>

      <div className="container py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl font-bold text-foreground">Claims Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Overview of all submitted insurance claims.</p>
        </motion.div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total Claims", value: stats.total, color: "text-foreground" },
            { label: "Approved", value: stats.approved, color: "text-success" },
            { label: "Pending", value: stats.pending, color: "text-warning" },
            { label: "Flagged", value: stats.flagged, color: "text-flagged" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="rounded-xl border border-border bg-card p-5 card-shadow"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Claims Table */}
        <div className="mt-8 rounded-xl border border-border bg-card card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claim ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claimant</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fraud Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {claims.map((claim, i) => {
                  const Icon = claimTypeIcon[claim.claimType];
                  return (
                    <motion.tr
                      key={claim.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="group transition-colors hover:bg-secondary/30 cursor-pointer"
                      onClick={() => navigate(`/claim/${claim.id}`)}
                    >
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{claim.id}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">{claim.claimantName}</div>
                        <div className="text-xs text-muted-foreground">{claim.claimantEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          {claim.claimType}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">
                        ${claim.claimAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="px-6 py-4">
                        <FraudScore score={claim.fraudScore} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{claim.submittedAt}</td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/claim/${claim.id}`}
                          className="inline-flex items-center gap-1 text-sm text-primary opacity-0 transition-all group-hover:opacity-100 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
