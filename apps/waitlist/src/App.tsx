import { useState, useEffect } from "react";
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
  BookmarkPlus,
  Lock,
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

// ─── Product mockup (hero) ───────────────────────────────────────────────────

function ProductMockup() {
  return (
    <div className="mockup-card">
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
      <p className="text-gray-500 text-[10px] mb-3">1247 Maple St · 3BR/2BA · $485,000</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Cap Rate", value: "6.8%", color: "text-green-400" },
          { label: "Cash-on-Cash", value: "8.2%", color: "text-blue-400" },
          { label: "1% Rule", value: "✓ Pass", color: "text-green-400" },
        ].map((m) => (
          <div key={m.label} className="flex flex-col items-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            <span className="text-gray-500 text-[9px] mb-1 text-center leading-tight">{m.label}</span>
            <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-purple-500/[0.08] border border-purple-500/20 mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-purple-300 text-[9px] font-semibold uppercase tracking-widest">AI Verdict</span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed">
          "Strong fundamentals with below-market rent upside. Cap rate of 6.8% exceeds local average by 1.2%."
        </p>
      </div>
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

// ─── Browser chrome wrapper ──────────────────────────────────────────────────

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080f1e] overflow-hidden shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#0c1323] border-b border-white/[0.06]">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] min-w-0">
          <Lock className="w-2.5 h-2.5 text-gray-500 shrink-0" />
          <span className="text-gray-500 text-[11px] truncate">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Extension demo ──────────────────────────────────────────────────────────

const EXT_METRICS = [
  { label: "Cap Rate", value: "6.8%", color: "text-green-400", showAt: 2 },
  { label: "Cash-on-Cash", value: "8.2%", color: "text-blue-400", showAt: 3 },
  { label: "Monthly CF", value: "+$312/mo", color: "text-green-400", showAt: 4 },
  { label: "1% Rule", value: "✓ Pass", color: "text-green-400", showAt: 5 },
  { label: "GRM", value: "12.4", color: "text-gray-300", showAt: 6 },
];

const EXT_PHASE_DELAYS = [1000, 1400, 450, 450, 450, 450, 450, 3600];

function ExtensionPanel({ phase }: { phase: number }) {
  const scanning = phase === 1;
  const analyzing = phase >= 2 && phase < 7;
  const done = phase >= 7;

  return (
    <div className="w-52 shrink-0 flex flex-col bg-[#0a1120] border-l border-white/[0.06] p-3.5 text-white">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Building2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-white text-[11px] font-bold">icecap</span>
        </div>
        <div className="h-4 flex items-center">
          {done && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-[9px] font-semibold">
              ✓ Strong Buy
            </span>
          )}
          {(scanning || analyzing) && (
            <span className="inline-flex items-center gap-1 text-blue-400 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full border border-blue-400 border-t-transparent animate-spin" />
              {scanning ? "Scanning" : "Analyzing"}
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 mb-3">
        {EXT_METRICS.map((m) => (
          <div
            key={m.label}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] transition-opacity duration-500 ${
              phase >= m.showAt ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="text-gray-500 text-[10px]">{m.label}</span>
            <span className={`text-[10px] font-semibold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* AI verdict */}
      <div
        className={`p-2.5 rounded-xl bg-purple-500/[0.08] border border-purple-500/20 mb-3 transition-opacity duration-700 ${
          done ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-1 mb-1.5">
          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
          <span className="text-purple-300 text-[8px] font-semibold uppercase tracking-widest">AI Verdict</span>
        </div>
        <p className="text-gray-300 text-[10px] leading-relaxed">
          "Strong fundamentals. Cap rate exceeds local average by 1.2%. Recommend investing."
        </p>
      </div>

      {/* Save button */}
      <button
        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-semibold transition-all duration-500 ${
          done ? "opacity-100" : "opacity-30 cursor-default"
        }`}
      >
        <BookmarkPlus className="w-3 h-3" />
        Save to Portfolio
      </button>
    </div>
  );
}

function ExtensionDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const delay = EXT_PHASE_DELAYS[phase] ?? 1000;
    const t = setTimeout(() => setPhase((p) => (p >= 7 ? 0 : p + 1)), delay);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <BrowserChrome url="www.redfin.com/TX/Austin/1247-Maple-St-78701/home/12345678">
      <div className="flex min-h-[380px]">
        {/* Listing page */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Image placeholder */}
          <div className="relative w-full h-32 rounded-xl bg-gradient-to-br from-slate-700/60 to-slate-800/60 border border-white/[0.06] overflow-hidden mb-4 flex items-center justify-center">
            <Building2 className="w-14 h-14 text-white/[0.07]" />
            <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/50">
              <span className="text-white/60 text-[10px]">1247 Maple Street · Austin, TX</span>
            </div>
          </div>

          {/* Price & details */}
          <p className="text-white font-bold text-xl mb-0.5">$485,000</p>
          <p className="text-gray-400 text-xs mb-3">1247 Maple Street, Austin TX 78701</p>
          <div className="flex items-center gap-3 text-gray-500 text-xs mb-4">
            <span>3 bed</span>
            <span className="text-gray-700">·</span>
            <span>2 bath</span>
            <span className="text-gray-700">·</span>
            <span>1,450 sq ft</span>
          </div>

          {/* Listing snippets */}
          <div className="space-y-1.5">
            {["Well-maintained duplex in the heart of South Austin.", "Estimated monthly rental income: $3,200/mo.", "New HVAC installed 2023. Strong rental demand."].map((line) => (
              <p key={line} className="text-gray-600 text-[11px] leading-relaxed">{line}</p>
            ))}
          </div>
        </div>

        {/* Icecap panel */}
        <ExtensionPanel phase={phase} />
      </div>
    </BrowserChrome>
  );
}

// ─── Hub demo ────────────────────────────────────────────────────────────────

const HUB_NAV = [
  { icon: Building2, label: "Portfolio", active: true },
  { icon: BarChart3, label: "Compare", active: false },
  { icon: Brain, label: "AI Copilot", active: false },
  { icon: TrendingUp, label: "Reports", active: false },
];

const HUB_DEALS = [
  { address: "1247 Maple St", city: "Austin, TX", cap: "6.8%", coc: "8.2%", verdict: "Strong Buy", vColor: "text-green-400", vBg: "bg-green-500/10 border-green-500/20" },
  { address: "892 Oak Avenue", city: "Denver, CO", cap: "5.2%", coc: "6.1%", verdict: "Investigate", vColor: "text-yellow-400", vBg: "bg-yellow-500/10 border-yellow-500/20" },
  { address: "3421 Pine Road", city: "Phoenix, AZ", cap: "7.4%", coc: "9.1%", verdict: "Strong Buy", vColor: "text-green-400", vBg: "bg-green-500/10 border-green-500/20" },
  { address: "556 Elm Court", city: "Dallas, TX", cap: "4.1%", coc: "4.8%", verdict: "Pass", vColor: "text-gray-500", vBg: "bg-white/[0.03] border-white/10" },
];

function HubDemo() {
  return (
    <BrowserChrome url="app.icecap.io/portfolio">
      <div className="flex min-h-[380px]">
        {/* Sidebar */}
        <div className="w-44 shrink-0 bg-[#080d1a] border-r border-white/[0.06] flex flex-col py-4">
          <div className="flex items-center gap-2 px-4 mb-6">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white text-xs font-bold">icecap</span>
          </div>
          <nav className="space-y-0.5 px-2">
            {HUB_NAV.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/20"
                    : "text-gray-500 hover:text-gray-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </nav>
        </div>

        {/* Main */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold text-sm">Portfolio Overview</h3>
              <p className="text-gray-500 text-[11px]">4 deals tracked</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 text-white text-[11px] font-semibold">
              <Zap className="w-3 h-3" />
              New Analysis
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Pipeline Value", value: "$2.4M" },
              { label: "Avg Cap Rate", value: "7.1%" },
              { label: "Deals Analyzed", value: "8" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <p className="text-white font-bold text-base">{s.value}</p>
                <p className="text-gray-500 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Deals table */}
          <div className="space-y-1.5">
            <div className="flex items-center px-2 mb-2">
              <span className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider">Recent Deals</span>
            </div>
            {HUB_DEALS.map((deal) => (
              <div
                key={deal.address}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-semibold truncate">{deal.address}</p>
                  <p className="text-gray-500 text-[10px]">{deal.city}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-green-400 text-[10px] font-mono">{deal.cap}</span>
                  <span className="text-gray-700 text-[10px]">/</span>
                  <span className="text-blue-400 text-[10px] font-mono">{deal.coc}</span>
                </div>
                <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full border text-[9px] font-semibold ${deal.vBg} ${deal.vColor}`}>
                  {deal.verdict}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-700 group-hover:text-gray-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

// ─── Demo section ────────────────────────────────────────────────────────────

type DemoTab = "extension" | "hub";

function DemoSection() {
  const [activeTab, setActiveTab] = useState<DemoTab>("extension");

  return (
    <section className="relative z-10 py-28 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
            See it in action
          </div>
          <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">
            Watch Icecap work.
          </h2>
          <p className="text-gray-400 max-w-md mx-auto">
            From the listing page to your portfolio dashboard — this is what your workflow looks
            like with Icecap.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            {(
              [
                { key: "extension" as DemoTab, icon: Chrome, label: "Extension · Live Analysis" },
                { key: "hub" as DemoTab, icon: BarChart3, label: "Hub · Portfolio Dashboard" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Demo area */}
        <div className="relative">
          <div className="absolute inset-0 bg-blue-700/[0.06] blur-3xl rounded-3xl pointer-events-none" />
          <div className="relative">
            {activeTab === "extension" ? <ExtensionDemo /> : <HubDemo />}
          </div>
        </div>

        {/* Caption */}
        <p className="text-center text-gray-600 text-xs mt-5">
          {activeTab === "extension"
            ? "The extension panel appears automatically on any listing page — no clicking needed."
            : "Every deal you save from the extension syncs instantly to your Hub dashboard."}
        </p>
      </div>
    </section>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: LucideIcon;
  color: "blue" | "purple" | "cyan";
  title: string;
  description: string;
}

const COLOR_MAP: Record<"blue" | "purple" | "cyan", { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400" },
};

function FeatureCard({ icon: Icon, color, title, description }: FeatureCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="feature-card group">
      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5`}>
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
              We'll reach out to <span className="text-gray-300">{email}</span> when Icecap launches.
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
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500/70" />Free to join</span>
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500/70" />No spam</span>
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500/70" />Cancel anytime</span>
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

  const formProps = { email, name, submitting, submitted, error, onEmailChange: setEmail, onNameChange: setName, onSubmit: handleSubmit };

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
        <a href="#waitlist" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20">
          Join Waitlist
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16">
        <HeroBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 xl:gap-24 items-center py-24">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Limited Early Access — Join the Waitlist
            </div>
            <h1 className="text-5xl xl:text-[3.75rem] font-black leading-[1.07] tracking-tight mb-6">
              Stop Guessing<br />on Deals.<br />
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
          <div className="hidden lg:flex justify-center items-center fade-up-delay">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full scale-75 translate-y-8" />
              <ProductMockup />
            </div>
          </div>
        </div>
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
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">Every edge in one extension.</h2>
            <p className="text-gray-400 max-w-md mx-auto">Built for investors who need real data, not real estate theater.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard icon={Zap} color="blue" title="Instant Napkin Math" description="Cap Rate, Cash-on-Cash, 1% Rule, and GRM — calculated live as you scroll through listings. No copy-pasting to a spreadsheet." />
            <FeatureCard icon={Brain} color="purple" title="AI Deal Intelligence" description="Gemini AI reads every listing and gives you a plain-English verdict. Is this deal worth your time, or should you keep scrolling?" />
            <FeatureCard icon={BarChart3} color="cyan" title="Portfolio Dashboard" description="Track every deal you've analyzed. Compare properties side-by-side and spot patterns across your entire pipeline." />
          </div>
        </div>
      </section>

      {/* ── Demo ── */}
      <DemoSection />

      {/* ── How it works ── */}
      <section className="relative z-10 py-28 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
              How it works
            </div>
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">Dead simple. Brutally effective.</h2>
            <p className="text-gray-400 max-w-sm mx-auto">No setup. No learning curve. Just install and start investing smarter.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            <StepCard step="01" icon={Chrome} title="Install & Browse" description="Add Icecap to Chrome and start browsing Zillow, Redfin, or Realtor.com like you normally would." isLast={false} />
            <StepCard step="02" icon={Zap} title="Auto-Analysis" description="Open any listing. Icecap scrapes the data and runs all the numbers automatically — no clicking needed." isLast={false} />
            <StepCard step="03" icon={TrendingUp} title="Decide with Data" description="Get metrics, an AI verdict, and a clear picture. Save deals to your portfolio with one tap." isLast={true} />
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 py-28 border-t border-white/[0.06]">
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          <div className="absolute inset-0 bg-blue-700/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-block px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
              Limited spots · Be first
            </div>
            <h2 className="text-4xl xl:text-5xl font-black tracking-tight mb-4">Be first in line.</h2>
            <p className="text-gray-400 mb-10 max-w-sm mx-auto">
              We're opening Icecap to a small group of investors early. Get priority access and help shape the product.
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
            <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
