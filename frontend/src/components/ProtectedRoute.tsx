import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    // Both token and enc_key must be present — a session without enc_key can't decrypt anything
    const isAuthenticated = useAuthStore((s) => s.accessToken && s.encKey);

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}