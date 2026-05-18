import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./core/firebase";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Zap,
  Brain,
  BarChart3,
  Chrome,
  TrendingUp,
  ArrowRight,
  Check,
  Sparkles,
  ChevronDown,
} from "lucide-react";

// ─── Background ─────────────────────────────────────────────────────────────

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />
      <div className="orb orb-cyan" />
      <div className="dot-grid" />
    </div>
  );
}

// ─── Product mockup ──────────────────────────────────────────────────────────

function ProductMockup() {
  return (
    <div className="mockup-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-500/30">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white text-xs font-bold tracking-tight">Icecap</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-[10px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Strong Buy
        </span>
      </div>

      {/* Address */}
      <p className="text-gray-500 text-[10px] mb-3">1247 Maple St · 3BR/2BA · $485,000</p>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Cap Rate", value: "6.8%", color: "text-green-400" },
          { label: "Cash-on-Cash", value: "8.2%", color: "text-blue-400" },
          { label: "1% Rule", value: "✓ Pass", color: "text-green-400" },
        ].map((m) => (
          <div
            key={m.label}
            className="flex flex-col items-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.07]"
          >
            <span className="text-gray-500 text-[9px] mb-1 text-center leading-tight">
              {m.label}
            </span>
            <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* AI verdict */}
      <div className="p-3 rounded-xl bg-purple-500/[0.08] border border-purple-500/20 mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-purple-300 text-[9px] font-semibold uppercase tracking-widest">
            AI Verdict
          </span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed">
          "Strong fundamentals with below-market rent upside. Cap rate of 6.8% exceeds local
          average by 1.2%. Recommend investigating further."
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-gray-600 text-[9px]">Analyzed in 3.2s</span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-500/70 text-[9px]">Live</span>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: LucideIcon;
  color: "blue" | "purple" | "cyan";
  title: string;
  description: string;
}

const COLOR_MAP: Record<
  "blue" | "purple" | "cyan",
  { bg: string; border: string; text: string }
> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
  },
};

function FeatureCard({ icon: Icon, color, title, description }: FeatureCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="feature-card group">
      <div
        className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5`}
      >
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <h3 className="text-white font-bold text-base mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Step card ───────────────────────────────────────────────────────────────

interface StepCardProps {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  isLast: boolean;
}

function StepCard({ step, icon: Icon, title, description, isLast }: StepCardProps) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
          <Icon className="w-7 h-7 text-gray-300" />
        </div>
        <span className="absolute -top-2.5 -right-2.5 text-[10px] font-black text-gray-600 bg-[#050b1a] px-1 rounded">
          {step}
        </span>
      </div>
      <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed max-w-[200px]">{description}</p>
      {!isLast && (
        <div className="hidden md:block absolute top-8 left-[calc(50%+44px)] right-[calc(-50%+44px)] border-t border-dashed border-white/10" />
      )}
    </div>
  );
}

// ─── Sign-up form ────────────────────────────────────────────────────────────

interface SignupFormProps {
  email: string;
  name: string;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  onEmailChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  compact?: boolean;
}

function SignupForm({
  email,
  name,
  submitting,
  submitted,
  error,
  onEmailChange,
  onNameChange,
  onSubmit,
  compact = false,
}: SignupFormProps) {
  if (submitted) {
    return (
      <div className="success-card">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">You're on the list!</p>
            <p className="text-gray-400 text-sm mt-0.5">
              We'll reach out to{" "}
              <span className="text-gray-300">{email}</span> when Icecap launches.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!compact && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="First name (optional)"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="form-input"
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            className="form-input"
          />
        </div>
      )}
      {compact && (
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            className="form-input"
          />
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className={compact ? "flex justify-center" : ""}>
        <button type="submit" disabled={submitting} className="cta-button w-full sm:w-auto">
          {submitting ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="spinner" />
              Joining...
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              Get Early Access
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </div>
      {!compact && (
        <div className="flex items-center gap-5 text-gray-600 text-xs">
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500/70" />
            Free to join
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500/70" />
            No spam
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500/70" />
            Cancel anytime
          </span>
        </div>
      )}
    </form>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, "waitlist"), {
        email: trimmedEmail,
        name: name.trim(),
        createdAt: serverTimestamp(),
        source: "waitlist-page",
      });
      setSubmitted(true);
    } catch (err) {
      console.error("[waitlist] Firestore write failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formProps = {
    email,
    name,
    submitting,
    submitted,
    error,
    onEmailChange: setEmail,
    onNameChange: setName,
    onSubmit: handleSubmit,
  };

  return (
    <div className="min-h-screen bg-[#050b1a] text-white">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] backdrop-blur-xl bg-[#050b1a]/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">icecap</span>
        </div>
        <a
          href="#waitlist"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          Join Waitlist
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16">
        <HeroBackground />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 xl:gap-24 items-center py-24">
          {/* Left col */}
          <div className="fade-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Limited Early Access — Join the Waitlist
            </div>

            <h1 className="text-5xl xl:text-[3.75rem] font-black leading-[1.07] tracking-tight mb-6">
              Stop Guessing
              <br />
              on Deals.
              <br />
              <span className="gradient-text">Start Knowing.</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
              Icecap turns any Zillow, Redfin, or Realtor.com listing into a complete investment
              analysis — Cap Rate, Cash-on-Cash, ROI, and an AI verdict — in under 10 seconds.
              Right in your browser.
            </p>

            <div id="waitlist">
              <SignupForm {...formProps} />
            </div>
          </div>

          {/* Right col — mockup */}
          <div className="hidden lg:flex justify-center items-center fade-up-delay">
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full scale-75 translate-y-8" />
              <ProductMockup />
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-gray-600 text-[11px] bounce-subtle">
          <span>Scroll to learn more</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative z-10 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-3 divide-x divide-white/[0.06]">
          {[
            { value: "< 10s", label: "Time to full analysis" },
            { value: "3 platforms", label: "Zillow · Redfin · Realtor" },
            { value: "6+ metrics", label: "Calculated instantly" },
          ].map((stat) => (
            <div key={stat.label} className="stat-item">
              <div className="text-2xl xl:text-3xl font-black text-white mb-1">{stat.value}</div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
              What you'll unlock
            </div>
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">
              Every edge in one extension.
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Built for investors who need real data, not real estate theater.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard
              icon={Zap}
              color="blue"
              title="Instant Napkin Math"
              description="Cap Rate, Cash-on-Cash, 1% Rule, and GRM — calculated live as you scroll through listings. No copy-pasting to a spreadsheet."
            />
            <FeatureCard
              icon={Brain}
              color="purple"
              title="AI Deal Intelligence"
              description="Gemini AI reads every listing and gives you a plain-English verdict. Is this deal worth your time, or should you keep scrolling?"
            />
            <FeatureCard
              icon={BarChart3}
              color="cyan"
              title="Portfolio Dashboard"
              description="Track every deal you've analyzed. Compare properties side-by-side and spot patterns across your entire pipeline."
            />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 py-28 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
              How it works
            </div>
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">
              Dead simple. Brutally effective.
            </h2>
            <p className="text-gray-400 max-w-sm mx-auto">
              No setup. No learning curve. Just install and start investing smarter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            <StepCard
              step="01"
              icon={Chrome}
              title="Install & Browse"
              description="Add Icecap to Chrome and start browsing Zillow, Redfin, or Realtor.com like you normally would."
              isLast={false}
            />
            <StepCard
              step="02"
              icon={Zap}
              title="Auto-Analysis"
              description="Open any listing. Icecap scrapes the data and runs all the numbers automatically — no clicking needed."
              isLast={false}
            />
            <StepCard
              step="03"
              icon={TrendingUp}
              title="Decide with Data"
              description="Get metrics, an AI verdict, and a clear picture. Save deals to your portfolio with one tap."
              isLast={true}
            />
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 py-28 border-t border-white/[0.06]">
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          {/* Glow */}
          <div className="absolute inset-0 bg-blue-700/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
              Limited spots · Be first
            </div>
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">
              Be first in line.
            </h2>
            <p className="text-gray-400 mb-10 max-w-sm mx-auto">
              We're opening Icecap to a small group of investors early. Get priority access and
              help shape the product.
            </p>
            <SignupForm {...formProps} compact />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-gray-500 text-sm">© 2025 Icecap. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-gray-600 text-sm">
            <a href="/privacy" className="hover:text-gray-400 transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-gray-400 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
