import { useEffect, useRef, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, type Variants } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
        description: "Session locks after 5 minutes of inactivity. Encryption key wiped from memory on tab close.",
    },
];

const STACK_ITEMS = [
    { label: "Frontend", techs: "React · TypeScript · Vite · Tailwind · Web Crypto API" },
    { label: "Backend", techs: "FastAPI · SQLAlchemy 2.0 · PostgreSQL · Redis" },
    { label: "Crypto", techs: "Argon2id (WASM) · HKDF-SHA256 · AES-256-GCM" },
    { label: "Infra", techs: "Docker Compose · Nginx · TLS · Rate Limiting" },
];

const PIPELINE_STEPS = [
    { text: "master_password + email", color: "text-violet-400", glow: true },
    { text: "        ↓", color: "text-gray-600" },
    { text: "   salt = SHA256(email)", color: "text-gray-400" },
    { text: "        ↓", color: "text-gray-600" },
    { text: "   Argon2id(64MB, 3 iter, par 4)", color: "text-gray-400" },
    { text: "        ↓", color: "text-gray-600" },
    { text: "   master_key (512 bits)", color: "text-violet-400", glow: true },
    { text: "        ├───────────────────────┐", color: "text-gray-600" },
    { text: "        ↓                       ↓", color: "text-gray-600" },
    { text: "   HKDF(\"auth\")            HKDF(\"enc\")", color: "text-gray-400" },
    { text: "        ↓                       ↓", color: "text-gray-600" },
    { text: "   auth_key → server       enc_key → never leaves browser", color: "", split: true },
];

const CIPHER_CHARS = "0123456789abcdef!@#$%^&*<>{}[]|/\\";

const PARTICLE_COUNT = 70;
const CONNECTION_DISTANCE = 140;
const MOUSE_RADIUS = 200;

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.25, 0.1, 0, 1] },
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

// ---------------------------------------------------------------------------
// Interactive particle constellation — canvas-based, mouse-reactive
// ---------------------------------------------------------------------------

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    baseOpacity: number;
}

function createParticle(w: number, h: number): Particle {
    return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.8 + 0.5,
        baseOpacity: Math.random() * 0.4 + 0.1,
    };
}

function ParticleNetwork() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        function resize() {
            canvas!.width = window.innerWidth;
            canvas!.height = window.innerHeight;
        }
        resize();

        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
            createParticle(canvas.width, canvas.height)
        );

        function onMouseMove(e: MouseEvent) {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        }
        function onMouseLeave() {
            mouseRef.current = { x: -1000, y: -1000 };
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseleave", onMouseLeave);
        window.addEventListener("resize", resize);

        function animate() {
            if (!ctx || !canvas) return;
            const { width, height } = canvas;
            const mouse = mouseRef.current;
            const particles = particlesRef.current;

            ctx.clearRect(0, 0, width, height);

            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
                p.x = Math.max(0, Math.min(width, p.x));
                p.y = Math.max(0, Math.min(height, p.y));
            }

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONNECTION_DISTANCE) {
                        const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.12;
                        ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }

                const dx = particles[i].x - mouse.x;
                const dy = particles[i].y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < MOUSE_RADIUS) {
                    const opacity = (1 - dist / MOUSE_RADIUS) * 0.35;
                    ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            for (const p of particles) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                let opacity = p.baseOpacity;
                let size = p.size;
                if (dist < MOUSE_RADIUS) {
                    const proximity = 1 - dist / MOUSE_RADIUS;
                    opacity += proximity * 0.6;
                    size += proximity * 2;
                }

                if (opacity > 0.3) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(139, 92, 246, ${opacity * 0.15})`;
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(167, 139, 250, ${Math.min(opacity, 1)})`;
                ctx.fill();
            }

            animRef.current = requestAnimationFrame(animate);
        }

        animRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseleave", onMouseLeave);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
}

// ---------------------------------------------------------------------------
// Mouse-following gradient spotlight
// ---------------------------------------------------------------------------

function MouseSpotlight() {
    const [pos, setPos] = useState({ x: -1000, y: -1000 });

    useEffect(() => {
        let targetX = -1000;
        let targetY = -1000;
        let currentX = -1000;
        let currentY = -1000;
        let raf: number;

        function onMouseMove(e: MouseEvent) {
            targetX = e.clientX;
            targetY = e.clientY + window.scrollY;
        }

        function tick() {
            currentX += (targetX - currentX) * 0.08;
            currentY += (targetY - currentY) * 0.08;
            setPos({ x: currentX, y: currentY });
            raf = requestAnimationFrame(tick);
        }

        window.addEventListener("mousemove", onMouseMove);
        raf = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{
                background: `radial-gradient(700px circle at ${pos.x}px ${pos.y}px, rgba(139, 92, 246, 0.04), transparent 40%)`,
                zIndex: 1,
            }}
        />
    );
}

// ---------------------------------------------------------------------------
// Decrypt text effect
// ---------------------------------------------------------------------------

function DecryptText({
                         text,
                         className = "",
                         delay = 0,
                         duration = 1.2,
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
// Animated pipeline — GSAP ScrollTrigger
// ---------------------------------------------------------------------------

function AnimatedPipeline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const linesRef = useRef<(HTMLParagraphElement | null)[]>([]);

    const setLineRef = useCallback((el: HTMLParagraphElement | null, i: number) => {
        linesRef.current[i] = el;
    }, []);

    useEffect(() => {
        const lines = linesRef.current.filter(Boolean);
        if (lines.length === 0) return;

        gsap.set(lines, { opacity: 0, x: -16 });

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top 80%",
                once: true,
            },
        });

        lines.forEach((line, i) => {
            tl.to(line!, {
                opacity: 1,
                x: 0,
                duration: 0.35,
                ease: "power2.out",
            }, i * 0.1);

            const step = PIPELINE_STEPS[i];
            if (step?.glow) {
                tl.fromTo(line!, {
                    textShadow: "0 0 0px rgba(139, 92, 246, 0)",
                }, {
                    textShadow: "0 0 24px rgba(139, 92, 246, 0.7)",
                    duration: 0.5,
                    yoyo: true,
                    repeat: 1,
                    ease: "power2.inOut",
                }, i * 0.1 + 0.15);
            }
        });

        return () => {
            tl.kill();
            ScrollTrigger.getAll().forEach(st => st.kill());
        };
    }, []);

    return (
        <div ref={containerRef} className="relative bg-[#0a0c12]/80 backdrop-blur-sm border border-[#1e2030] rounded-2xl p-6 sm:p-8 overflow-hidden">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#1e2030]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                <span className="text-[11px] text-gray-600 ml-3 font-mono tracking-wider">key_derivation_pipeline.sh</span>
            </div>

            <div className="font-mono text-xs sm:text-sm space-y-0.5 overflow-x-auto">
                {PIPELINE_STEPS.map((step, i) => (
                    <p
                        key={i}
                        ref={(el) => setLineRef(el, i)}
                        className={step.split ? "whitespace-pre" : `${step.color} whitespace-pre`}
                    >
                        {step.split ? (
                            <>
                                <span className="text-green-400">   auth_key</span>
                                <span className="text-gray-600"> → server       </span>
                                <span className="text-red-400">   enc_key</span>
                                <span className="text-gray-600"> → never leaves browser</span>
                            </>
                        ) : (
                            step.text
                        )}
                    </p>
                ))}
            </div>

            {/* CRT scanline overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)",
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
                duration: 0.6,
                delay: index * 0.08,
                ease: [0.25, 0.1, 0, 1],
            }}
            whileHover={{
                y: -4,
                transition: { duration: 0.25, ease: "easeOut" },
            }}
            className="group relative bg-[#12141c]/60 backdrop-blur-sm border border-[#1e2030] rounded-xl p-5 cursor-default overflow-hidden"
        >
            {/* Hover glow — top edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/0 to-transparent group-hover:via-violet-500/50 transition-all duration-500" />

            <div className="relative">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600/10 mb-3 group-hover:bg-violet-600/20 transition-colors duration-300">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-white mb-1.5">{feature.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// Main LandingPage
// ---------------------------------------------------------------------------

export function LandingPage() {
    const featuresRef = useRef(null);
    const featuresInView = useInView(featuresRef, { once: true, margin: "-60px" });

    return (
        <div className="min-h-screen bg-[#0a0c12] text-white overflow-hidden">

            {/* ─── Background layers ─── */}
            <ParticleNetwork />
            <MouseSpotlight />

            {/* Film grain */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.035]" style={{ zIndex: 2 }}>
                <svg width="100%" height="100%">
                    <filter id="grain">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain)" />
                </svg>
            </div>

            {/* ─── Hero ─── */}
            <section className="relative" style={{ zIndex: 3 }}>
                <motion.div
                    className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center"
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                >
                    {/* Logo with orbital rings */}
                    <motion.div variants={scaleIn} className="relative inline-flex items-center justify-center w-20 h-20 mb-8">
                        <div
                            className="absolute w-20 h-20 rounded-full border border-violet-500/20"
                            style={{ animation: "spin 12s linear infinite" }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                        </div>

                        <div
                            className="absolute w-16 h-16 rounded-full border border-violet-500/10"
                            style={{ animation: "spin 8s linear infinite reverse" }}
                        >
                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-300/60 shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </motion.div>

                    {/* Title with decrypt */}
                    <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl font-bold tracking-tight mb-5">
                        <DecryptText text="Vault" delay={500} duration={0.9} className="text-white" />
                        <DecryptText text="Keeper" delay={700} duration={1.1} className="text-violet-400" />
                    </motion.h1>

                    <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-3 leading-relaxed">
                        A zero-knowledge password manager where the server never sees your data.
                    </motion.p>
                    <motion.p variants={fadeUp} className="text-sm text-gray-500/80 max-w-xl mx-auto mb-10 leading-relaxed">
                        All encryption happens in your browser. Your master password derives two independent keys
                        — one for authentication, one for encryption. The encryption key never leaves your device.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div variants={fadeUp} className="flex items-center justify-center gap-4">
                        <Link to="/register">
                            <motion.span
                                whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(139, 92, 246, 0.3)" }}
                                whileTap={{ scale: 0.97 }}
                                className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl px-7 py-3 transition-colors shadow-lg shadow-violet-600/20"
                            >
                                Create Account
                            </motion.span>
                        </Link>
                        <Link to="/login">
                            <motion.span
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                className="inline-block border border-[#2e303a] hover:border-violet-500/40 text-gray-300 hover:text-white font-medium rounded-xl px-7 py-3 transition-all duration-300"
                            >
                                Sign In
                            </motion.span>
                        </Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* ─── Key Derivation Pipeline ─── */}
            <section className="relative max-w-3xl mx-auto px-6 pb-20" style={{ zIndex: 3 }}>
                <motion.h2
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-5 text-center"
                >
                    Key Derivation Pipeline
                </motion.h2>
                <AnimatedPipeline />
            </section>

            {/* ─── Features ─── */}
            <section ref={featuresRef} className="relative max-w-4xl mx-auto px-6 pb-20" style={{ zIndex: 3 }}>
                <motion.h2
                    initial={{ opacity: 0 }}
                    animate={featuresInView ? { opacity: 1 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-8 text-center"
                >
                    Security Architecture
                </motion.h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FEATURES.map((feature, i) => (
                        <FeatureCard key={feature.title} feature={feature} index={i} />
                    ))}
                </div>
            </section>

            {/* ─── Tech Stack ─── */}
            <section className="relative max-w-3xl mx-auto px-6 pb-20" style={{ zIndex: 3 }}>
                <motion.h2
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-8 text-center"
                >
                    Tech Stack
                </motion.h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STACK_ITEMS.map((item, i) => (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{
                                duration: 0.6,
                                delay: i * 0.1,
                                ease: [0.25, 0.1, 0, 1],
                            }}
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            className="group bg-[#12141c]/60 backdrop-blur-sm border border-[#1e2030] rounded-xl px-5 py-4 cursor-default relative overflow-hidden"
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/0 to-transparent group-hover:via-violet-500/40 transition-all duration-500" />
                            <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">{item.label}</span>
                            <p className="text-sm text-gray-300 mt-1">{item.techs}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── Footer ─── */}
            <motion.footer
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="relative border-t border-[#1e2030] py-12"
                style={{ zIndex: 3 }}
            >
                <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-5">
                    <div className="flex items-center gap-3">
                        {[
                            { user: "Kazxye", label: "Kazxye" },
                            { user: "giiuk", label: "giiuk" },
                        ].map((dev) => (
                            <motion.a
                                key={dev.user}
                                href={`https://github.com/${dev.user}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-[#1e2030] hover:border-violet-500/30 bg-[#12141c]/60 backdrop-blur-sm transition-all duration-300"
                            >
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-violet-400 transition-colors duration-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors duration-300">
                                    {dev.label}
                                </span>
                            </motion.a>
                        ))}
                    </div>

                    <p className="text-[11px] text-gray-600 tracking-wide">
                        Built with React · FastAPI · Web Crypto API — Zero-knowledge by design
                    </p>
                </div>
            </motion.footer>

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