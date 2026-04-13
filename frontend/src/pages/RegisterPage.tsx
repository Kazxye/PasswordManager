import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { register } from "../api/auth";
import { StrengthMeter } from "../components/StrengthMeter";

// ---------------------------------------------------------------------------
// Shared cipher charset for decrypt effect
// ---------------------------------------------------------------------------

const CIPHER_CHARS = "0123456789abcdef!@#$%^&*<>{}[]|/\\";

function DecryptText({
                         text,
                         className = "",
                         delay = 0,
                         duration = 1.0,
                     }: {
    text: string;
    className?: string;
    delay?: number;
    duration?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        el.textContent = text.replace(/\S/g, () =>
            CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)]
        );

        const totalFrames = Math.ceil((duration * 1000) / 30);
        let frame = 0;
        let intervalId: ReturnType<typeof setInterval>;

        const timerId = setTimeout(() => {
            intervalId = setInterval(() => {
                const progress = frame / totalFrames;
                const resolvedCount = Math.floor(progress * text.length);

                el.textContent = text
                    .split("")
                    .map((char, i) => {
                        if (char === " ") return " ";
                        if (i < resolvedCount) return char;
                        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                    })
                    .join("");

                frame++;
                if (frame > totalFrames) {
                    el.textContent = text;
                    clearInterval(intervalId);
                }
            }, 30);
        }, delay);

        return () => {
            clearTimeout(timerId);
            clearInterval(intervalId!);
        };
    }, [text, delay, duration]);

    return <span ref={ref} className={className} />;
}

// ---------------------------------------------------------------------------
// Mouse-following spotlight (lighter version for auth pages)
// ---------------------------------------------------------------------------

function MouseSpotlight() {
    const posRef = useRef({ x: -1000, y: -1000 });
    const currentRef = useRef({ x: -1000, y: -1000 });
    const divRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            posRef.current = { x: e.clientX, y: e.clientY };
        }

        function tick() {
            const curr = currentRef.current;
            const target = posRef.current;
            curr.x += (target.x - curr.x) * 0.08;
            curr.y += (target.y - curr.y) * 0.08;

            if (divRef.current) {
                divRef.current.style.background = `radial-gradient(600px circle at ${curr.x}px ${curr.y}px, rgba(139, 92, 246, 0.04), transparent 40%)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        }

        window.addEventListener("mousemove", onMouseMove);
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return <div ref={divRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.25, 0.1, 0, 1] },
    },
};

const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.7, rotate: -10 },
    visible: {
        opacity: 1,
        scale: 1,
        rotate: 0,
        transition: { type: "spring", damping: 15, stiffness: 80 },
    },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", damping: 22, stiffness: 90, delay: 0.3 },
    },
};

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------

export function RegisterPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 12) {
            setError("Password must be at least 12 characters");
            return;
        }

        setLoading(true);
        try {
            await register(email, password);
            navigate("/login");
        } catch (err) {
            if (isAxiosError(err) && err.response?.status === 409) {
                setError("Email already in use");
            } else {
                setError("Something went wrong. Please try again.");
                console.error("[RegisterPage] unexpected error:", err);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0c12] text-white flex items-center justify-center px-4 overflow-hidden">

            {/* ─── Background ─── */}
            <MouseSpotlight />

            {/* Ambient glow */}
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/6 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/4 rounded-full blur-[120px] pointer-events-none" />

            {/* Film grain */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ zIndex: 1 }}>
                <svg width="100%" height="100%">
                    <filter id="grain-register">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain-register)" />
                </svg>
            </div>

            {/* ─── Content ─── */}
            <div className="relative w-full max-w-md" style={{ zIndex: 2 }}>

                {/* Header */}
                <motion.div
                    className="mb-8 text-center"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Orbital logo */}
                    <motion.div variants={scaleIn} className="relative inline-flex items-center justify-center w-16 h-16 mb-5">
                        <div
                            className="absolute w-16 h-16 rounded-full border border-violet-500/20"
                            style={{ animation: "spin 12s linear infinite" }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                        </div>
                        <div
                            className="absolute w-12 h-12 rounded-full border border-violet-500/10"
                            style={{ animation: "spin 8s linear infinite reverse" }}
                        >
                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-300/60" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </motion.div>

                    <motion.h1 variants={fadeUp} className="text-2xl font-bold tracking-tight">
                        <DecryptText text="Vault" delay={300} duration={0.7} className="text-white" />
                        <DecryptText text="Keeper" delay={450} duration={0.8} className="text-violet-400" />
                    </motion.h1>
                    <motion.p variants={fadeUp} className="text-gray-500 text-sm mt-1.5">
                        Create your account
                    </motion.p>
                </motion.div>

                {/* Form card */}
                <motion.form
                    onSubmit={handleSubmit}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="relative bg-[#12141c]/70 backdrop-blur-sm border border-[#1e2030] rounded-2xl p-8 space-y-5 overflow-hidden"
                >
                    {/* Top edge glow */}
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/20 to-transparent" />

                    {/* Error message with animation */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: "auto", marginBottom: 4 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 overflow-hidden"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Email */}
                    <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45, duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
                    >
                        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-[#0a0c12]/80 border border-[#1e2030] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-300"
                            placeholder="your@email.com"
                        />
                    </motion.div>

                    {/* Password */}
                    <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55, duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
                    >
                        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-[#0a0c12]/80 border border-[#1e2030] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-300"
                            placeholder="At least 12 characters"
                        />
                        <StrengthMeter password={password} />
                    </motion.div>

                    {/* Confirm password */}
                    <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65, duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
                    >
                        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Confirm password</label>
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            className="w-full bg-[#0a0c12]/80 border border-[#1e2030] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-300"
                            placeholder="••••••••"
                        />
                    </motion.div>

                    {/* Submit */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.75, duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
                    >
                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={!loading ? { scale: 1.02, boxShadow: "0 0 24px rgba(139, 92, 246, 0.25)" } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                            className="relative w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 transition-colors overflow-hidden"
                        >
                            {/* Shimmer effect during loading */}
                            {loading && (
                                <motion.div
                                    className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                                    animate={{ x: ["-100%", "200%"] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                            )}
                            <span className="relative">
                                {loading ? "Deriving keys..." : "Create Account"}
                            </span>
                        </motion.button>
                    </motion.div>

                    {/* Link to login */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.85, duration: 0.5 }}
                        className="text-center text-sm text-gray-500 pt-1"
                    >
                        Already have an account?{" "}
                        <Link to="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                            Sign in
                        </Link>
                    </motion.p>
                </motion.form>
            </div>

            {/* Keyframe for orbital animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}