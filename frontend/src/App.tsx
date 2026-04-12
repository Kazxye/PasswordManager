import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VaultList } from "./pages/VaultList";
import { EntryDetail } from "./pages/EntryDetail";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAutoLock } from "./hooks/useAutoLock";

function AppRoutes() {
    // Auto-lock lives here — inside BrowserRouter so it has access
    // to the full app lifecycle, and runs on every authenticated page.
    useAutoLock();

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route
                path="/vaults"
                element={
                    <ProtectedRoute>
                        <VaultList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/vaults/:vaultId"
                element={
                    <ProtectedRoute>
                        <EntryDetail />
                    </ProtectedRoute>
                }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}