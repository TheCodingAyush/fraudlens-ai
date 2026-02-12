import { Link } from "react-router-dom";
import { BarChart3, Zap, FileSearch, Shield } from "lucide-react";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  {
    icon: Zap,
    title: "Instant Processing",
    description: "AI analyzes claims in seconds, not days. Reduce processing time by up to 80%.",
  },
  {
    icon: Shield,
    title: "Fraud Detection",
    description: "Advanced pattern recognition flags suspicious claims with 95%+ accuracy.",
  },
  {
    icon: FileSearch,
    title: "Document Analysis",
    description: "Automatically extract and verify information from uploaded documents and photos.",
  },
  {
    icon: BarChart3,
    title: "Risk Scoring",
    description: "Real-time fraud risk scores with transparent, explainable AI decisions.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const Landing = () => {
  const { currentUser, isAdmin } = useAuth();

  return (
    <>

      {/* Hero */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img
            src={heroBg}
            alt="AI Technology Background"
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-hero-gradient opacity-80" />
          <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        </div>

        <div className="container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
              AI-POWERED CLAIMS INTELLIGENCE
            </span>
            <h1 className="mx-auto max-w-4xl text-5xl font-black leading-tight tracking-tight text-foreground md:text-7xl">
              Insurance Claims
              <br />
              <span className="text-gradient">Analyzed in Minutes</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              FraudLens AI uses advanced machine learning to process claims instantly,
              detect fraud with 95%+ accuracy, and deliver transparent risk assessments.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              {currentUser ? (
                // Logged in user buttons
                isAdmin ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl animate-pulse-glow"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/submit"
                      className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl animate-pulse-glow"
                    >
                      Submit a Claim
                    </Link>
                    <Link
                      to="/my-claims"
                      className="inline-flex h-12 items-center rounded-lg border border-border bg-secondary px-8 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
                    >
                      My Claims
                    </Link>
                  </>
                )
              ) : (
                // Not logged in buttons
                <>
                  <Link
                    to="/login"
                    className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl animate-pulse-glow"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex h-12 items-center rounded-lg border border-border bg-secondary px-8 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-24">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mb-16 text-center"
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-3xl font-bold tracking-tight text-foreground md:text-4xl"
            >
              How FraudLens Works
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="mx-auto mt-4 max-w-xl text-muted-foreground"
            >
              From submission to decision — powered by AI at every step.
            </motion.p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i + 2}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="group rounded-xl border border-border bg-card-gradient p-6 transition-all hover:border-primary/30 hover:glow card-shadow"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>FraudLens AI</span>
          </div>
          <span>© 2025 FraudLens. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
};

export default Landing;
