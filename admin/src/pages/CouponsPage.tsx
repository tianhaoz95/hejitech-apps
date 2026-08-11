import { useEffect, useState } from "react";
import {
  createCoupon,
  deactivatePromotionCode,
  deleteCoupon,
  formatDiscount,
  formatDuration,
  listCoupons,
  type StripeCoupon,
  type StripePromotionCode,
} from "../lib/coupons";

type DiscountType = "percent" | "amount";

interface FormState {
  name: string;
  discountType: DiscountType;
  value: string;
  currency: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths: string;
  maxRedemptions: string;
  redeemBy: string; // yyyy-mm-dd
  code: string;
  purpose: string;
}

const emptyForm: FormState = {
  name: "",
  discountType: "percent",
  value: "",
  currency: "usd",
  duration: "forever",
  durationInMonths: "",
  maxRedemptions: "",
  redeemBy: "",
  code: "",
  purpose: "",
};

export function CouponsPage() {
  const [promotionCodes, setPromotionCodes] = useState<StripePromotionCode[]>([]);
  const [bareCoupons, setBareCoupons] = useState<StripeCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const { promotionCodes: codes, coupons } = await listCoupons();
      setPromotionCodes(codes);
      const codedCouponIds = new Set(codes.map((c) => c.promotion.coupon?.id).filter((id): id is string => !!id));
      setBareCoupons(coupons.filter((c) => !codedCouponIds.has(c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const value = Number(form.value);
      await createCoupon({
        name: form.name.trim() || undefined,
        percentOff: form.discountType === "percent" ? value : undefined,
        amountOff: form.discountType === "amount" ? Math.round(value * 100) : undefined,
        currency: form.discountType === "amount" ? form.currency : undefined,
        duration: form.duration,
        durationInMonths: form.duration === "repeating" ? Number(form.durationInMonths) : undefined,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        redeemBy: form.redeemBy ? Math.floor(new Date(form.redeemBy).getTime() / 1000) : undefined,
        code: form.code.trim() || undefined,
        purpose: form.purpose.trim() || undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(promotionCodeId: string) {
    setBusyId(promotionCodeId);
    try {
      await deactivatePromotionCode(promotionCodeId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCoupon(couponId: string) {
    if (!confirm("Delete this coupon? Every promotion code built on it becomes permanently invalid.")) return;
    setBusyId(couponId);
    try {
      await deleteCoupon(couponId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Coupons</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New coupon
        </button>
      </div>

      {error && (
        <p className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Duration</th>
                <th>Redemptions</th>
                <th>Expires</th>
                <th>Purpose</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {promotionCodes.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: "var(--ink-faint)" }}>
                    No coupons yet.
                  </td>
                </tr>
              )}
              {promotionCodes.map((pc) => {
                const coupon = pc.promotion.coupon;
                const isActive = pc.active && !!coupon?.valid;
                return (
                <tr key={pc.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{pc.code}</td>
                  <td>{coupon ? formatDiscount(coupon) : "(coupon deleted)"}</td>
                  <td>{coupon ? formatDuration(coupon) : "—"}</td>
                  <td>
                    {pc.times_redeemed}
                    {pc.max_redemptions ? ` / ${pc.max_redemptions}` : ""}
                  </td>
                  <td>{pc.expires_at ? new Date(pc.expires_at * 1000).toLocaleDateString() : "—"}</td>
                  <td>{pc.metadata?.purpose ?? "—"}</td>
                  <td>
                    <span className={`badge ${isActive ? "badge-resolved" : "badge-inactive"}`}>
                      {isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    {pc.active && (
                      <button
                        className="btn-danger"
                        disabled={busyId === pc.id}
                        onClick={() => void handleDeactivate(pc.id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {bareCoupons.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem" }}>Coupons without a promotion code</h2>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Discount</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bareCoupons.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{c.id}</td>
                    <td>{c.name ?? "—"}</td>
                    <td>{formatDiscount(c)}</td>
                    <td>{formatDuration(c)}</td>
                    <td>
                      <button className="btn-danger" disabled={busyId === c.id} onClick={() => void handleDeleteCoupon(c.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>New coupon</h2>
            <form onSubmit={(e) => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <label>
                Name (shown on receipts, optional)
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer promo" />
              </label>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <label style={{ flex: 1 }}>
                  Discount type
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}
                  >
                    <option value="percent">Percent off</option>
                    <option value="amount">Amount off</option>
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  {form.discountType === "percent" ? "Percent (1-100)" : "Amount"}
                  <input
                    type="number"
                    required
                    min={0}
                    step={form.discountType === "percent" ? 1 : 0.01}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                </label>
                {form.discountType === "amount" && (
                  <label style={{ flex: 1 }}>
                    Currency
                    <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <label style={{ flex: 1 }}>
                  Duration
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value as FormState["duration"] })}
                  >
                    <option value="forever">Forever</option>
                    <option value="once">Once</option>
                    <option value="repeating">Repeating</option>
                  </select>
                </label>
                {form.duration === "repeating" && (
                  <label style={{ flex: 1 }}>
                    Months
                    <input
                      type="number"
                      required
                      min={1}
                      value={form.durationInMonths}
                      onChange={(e) => setForm({ ...form, durationInMonths: e.target.value })}
                    />
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <label style={{ flex: 1 }}>
                  Max redemptions (optional)
                  <input
                    type="number"
                    min={1}
                    value={form.maxRedemptions}
                    onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Expires (optional)
                  <input type="date" value={form.redeemBy} onChange={(e) => setForm({ ...form, redeemBy: e.target.value })} />
                </label>
              </div>

              <label>
                Code (leave blank to auto-generate)
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER25"
                />
              </label>

              <label>
                Purpose (internal tag, optional — e.g. personal_testing, influencer_promo)
                <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              </label>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
