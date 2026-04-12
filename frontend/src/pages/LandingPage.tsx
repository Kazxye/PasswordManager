import { Link } from "react-router-dom";

const FEATURES = [
    {
        icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
        title: "Zero-Knowledge",
        description: "Your master password never leaves your device. The server stores only encrypted blobs it cannot read.",
    },
    {
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        title: "AES-256-GCM",
        description: "Authenticated encryption via Web Crypto API. Each entry gets a unique random IV. Tamper-proof by design.",
    },
    {
        icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
        title: "Argon2id KDF",
        description: "Memory-hard key derivation (64MB, 3 iterations) via WASM. Resistant to GPU and ASIC brute force attacks.",
    },
    {
        icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
        title: "Token Rotation",
        description: "JWTs with 15-min TTL. Refresh tokens rotate on every use. One active session per user.",
    },
    {
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
        title: "Audit Logging",
        description: "Every auth event and vault access is recorded with IP, user agent, and timestamp for anomaly detection.",
    },
    {
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
        title: "Auto-Lock",
        description: "Session automatically locks after 5 minutes of inactivity. Encryption key wiped from memory on tab close.",
    },
];

const STACK_ITEMS = [
    { label: "Frontend", techs: "React · TypeScript · Vite · Tailwind · Web Crypto API" },
    { label: "Backend", techs: "FastAPI · SQLAlchemy 2.0 · PostgreSQL · Redis" },
    { label: "Crypto", techs: "Argon2id (WASM) · HKDF-SHA256 · AES-256-GCM" },
    { label: "Infra", techs: "Docker Compose · Nginx · TLS · Rate Limiting" },
];

export function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0f1117] text-white">

            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
                    {/* Logo */}
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 mb-6">
                        <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                        Vault<span className="text-violet-400">Keeper</span>
                    </h1>

                    <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-3">
                        A zero-knowledge password manager where the server never sees your data.
                    </p>
                    <p className="text-sm text-gray-500 max-w-xl mx-auto mb-8">
                        All encryption happens in your browser. Your master password derives two independent keys
                        — one for authentication, one for encryption. The encryption key never leaves your device.
                    </p>

                    {/* CTA */}
                    <div className="flex items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg px-6 py-2.5 transition-colors"
                        >
                            Create Account
                        </Link>
                        <Link
                            to="/login"
                            className="border border-[#2e303a] hover:border-violet-500/40 text-gray-300 hover:text-white font-medium rounded-lg px-6 py-2.5 transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* Key Derivation Diagram */}
            <section className="max-w-3xl mx-auto px-6 pb-16">
                <div className="bg-[#1a1d27] border border-[#2e303a] rounded-2xl p-6 sm:p-8">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Key Derivation Pipeline</h2>
                    <div className="font-mono text-xs sm:text-sm text-gray-300 space-y-1 overflow-x-auto">
                        <p className="text-violet-400">master_password + email</p>
                        <p className="text-gray-600">        │</p>
                        <p className="text-gray-500">   salt = SHA256(email)</p>
                        <p className="text-gray-600">        │</p>
                        <p className="text-gray-500">   Argon2id(64MB, 3 iter, parallelism 4)</p>
                        <p className="text-gray-600">        │</p>
                        <p className="text-violet-400">   master_key <span className="text-gray-600">(512 bits)</span></p>
                        <p className="text-gray-600">        ├──────────────────────┐</p>
                        <p>
                            <span className="text-gray-600">        │                      │</span>
                        </p>
                        <p>
                            <span className="text-green-400">   HKDF("auth")</span>
                            <span className="text-gray-600">            </span>
                            <span className="text-red-400">   HKDF("enc")</span>
                        </p>
                        <p>
                            <span className="text-gray-600">        │                      │</span>
                        </p>
                        <p>
                            <span className="text-green-400">   auth_key</span>
                            <span className="text-gray-600"> → server       </span>
                            <span className="text-red-400">   enc_key</span>
                            <span className="text-gray-600"> → never leaves browser</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* Features grid */}
            <section className="max-w-4xl mx-auto px-6 pb-16">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 text-center">Security Architecture</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="bg-[#1a1d27] border border-[#2e303a] rounded-xl p-5 hover:border-violet-500/20 transition-colors"
                        >
                            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600/10 mb-3">
                                <svg className="w-4.5 h-4.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                                </svg>
                            </div>
                            <h3 className="text-sm font-medium text-white mb-1">{feature.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tech stack */}
            <section className="max-w-3xl mx-auto px-6 pb-16">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 text-center">Tech Stack</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STACK_ITEMS.map((item) => (
                        <div
                            key={item.label}
                            className="bg-[#1a1d27] border border-[#2e303a] rounded-xl px-5 py-4"
                        >
                            <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">{item.label}</span>
                            <p className="text-sm text-gray-300 mt-1">{item.techs}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#2e303a] py-8 text-center">
                <p className="text-xs text-gray-600">
                    VaultKeeper — Portfolio project demonstrating zero-knowledge cryptographic architecture
                </p>
            </footer>
        </div>
    );
}