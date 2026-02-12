import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: "admin" | "user";
}

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

// Demo mode: allows testing without real Firebase config
const DEMO_MODE = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === "demo-api-key";

// Demo users for testing
const DEMO_USERS: Record<string, { password: string; displayName: string; role: "admin" | "user" }> = {
    "admin@fraudlens.ai": { password: "admin123", displayName: "Admin User", role: "admin" },
    "user@test.com": { password: "user123", displayName: "John Doe", role: "user" },
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check if user is admin (for demo, check email domain; in production, check custom claims)
    const isAdmin = userProfile?.role === "admin" ||
        (currentUser?.email?.endsWith("@fraudlens.ai") ?? false);

    useEffect(() => {
        if (DEMO_MODE) {
            // Demo mode: check localStorage for demo session
            const demoSession = localStorage.getItem("demo_user");
            if (demoSession) {
                const demoUser = JSON.parse(demoSession);
                setUserProfile(demoUser);
                setCurrentUser({ email: demoUser.email, uid: demoUser.uid } as User);
            }
            setIsLoading(false);
            return;
        }

        // Real Firebase auth listener
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (user) {
                setUserProfile({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.email?.endsWith("@fraudlens.ai") ? "admin" : "user",
                });
            } else {
                setUserProfile(null);
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
        if (DEMO_MODE) {
            // Demo login
            const demoUser = DEMO_USERS[email.toLowerCase()];
            if (demoUser && demoUser.password === password) {
                const profile: UserProfile = {
                    uid: `demo-${Date.now()}`,
                    email,
                    displayName: demoUser.displayName,
                    role: demoUser.role,
                };
                localStorage.setItem("demo_user", JSON.stringify(profile));
                setUserProfile(profile);
                setCurrentUser({ email, uid: profile.uid } as User);
                return;
            }
            throw new Error("Invalid email or password");
        }

        await signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email: string, password: string, displayName: string) => {
        if (DEMO_MODE) {
            // Demo registration
            const profile: UserProfile = {
                uid: `demo-${Date.now()}`,
                email,
                displayName,
                role: "user",
            };
            localStorage.setItem("demo_user", JSON.stringify(profile));
            setUserProfile(profile);
            setCurrentUser({ email, uid: profile.uid } as User);
            return;
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
    };

    const logout = async () => {
        if (DEMO_MODE) {
            localStorage.removeItem("demo_user");
            setCurrentUser(null);
            setUserProfile(null);
            return;
        }

        await signOut(auth);
    };

    const resetPassword = async (email: string) => {
        if (DEMO_MODE) {
            // Demo mode: just show message
            console.log("Demo mode: Password reset email would be sent to", email);
            return;
        }

        await sendPasswordResetEmail(auth, email);
    };

    const value: AuthContextType = {
        currentUser,
        userProfile,
        isLoading,
        isAdmin,
        login,
        register,
        logout,
        resetPassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
