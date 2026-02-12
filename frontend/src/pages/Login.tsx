import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading: authLoading } = useAuth();
    const { toast } = useToast();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const from = (location.state as { from?: string })?.from || "/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast({
                title: "Missing fields",
                description: "Please enter your email and password.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            toast({ title: "Welcome back!", description: "Login successful." });
            navigate(from, { replace: true });
        } catch (error) {
            toast({
                title: "Login failed",
                description: error instanceof Error ? error.message : "Invalid credentials",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center py-12 px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="mb-8 text-center">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                        <ArrowLeft className="h-4 w-4" /> Back to Home
                    </Link>
                    <div className="flex justify-center mb-4">
                        <div className="rounded-xl bg-primary/10 p-3">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
                    <p className="mt-2 text-muted-foreground">Sign in to your FraudLens AI account</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 card-shadow">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-secondary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-secondary pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <Link to="/forgot-password" className="text-primary hover:underline">
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        Don't have an account?{" "}
                        <Link to="/register" className="text-primary hover:underline">
                            Create one
                        </Link>
                    </div>

                    {/* Demo credentials hint */}
                    <div className="mt-6 rounded-lg bg-secondary p-4 text-sm">
                        <p className="font-medium text-foreground mb-2">Demo Credentials:</p>
                        <div className="space-y-1 text-muted-foreground">
                            <p><span className="font-mono">admin@fraudlens.ai</span> / <span className="font-mono">admin123</span> (Admin)</p>
                            <p><span className="font-mono">user@test.com</span> / <span className="font-mono">user123</span> (User)</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
