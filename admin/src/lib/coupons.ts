import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Minimal local mirrors of the Stripe objects the admin* Cloud Functions
// return (backend/functions-billing/src/index.ts) — only the fields this
// UI actually reads, not the full Stripe SDK shape.
export interface StripeCoupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  duration_in_months: number | null;
  max_redemptions: number | null;
  redeem_by: number | null;
  times_redeemed: number;
  valid: boolean;
  metadata: Record<string, string>;
}

export interface StripePromotionCode {
  id: string;
  code: string;
  active: boolean;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: number | null;
  metadata: Record<string, string>;
  coupon: StripeCoupon;
}

export interface CreateCouponInput {
  name?: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  maxRedemptions?: number;
  redeemBy?: number;
  code?: string;
  purpose?: string;
}

export async function listCoupons(): Promise<{ promotionCodes: StripePromotionCode[]; coupons: StripeCoupon[] }> {
  const call = httpsCallable<Record<string, never>, { promotionCodes: StripePromotionCode[]; coupons: StripeCoupon[] }>(
    functions,
    "adminListCoupons",
  );
  const { data } = await call({});
  return data;
}

export async function createCoupon(input: CreateCouponInput): Promise<{ coupon: StripeCoupon; promotionCode: StripePromotionCode }> {
  const call = httpsCallable<CreateCouponInput, { coupon: StripeCoupon; promotionCode: StripePromotionCode }>(
    functions,
    "adminCreateCoupon",
  );
  const { data } = await call(input);
  return data;
}

export async function deactivatePromotionCode(promotionCodeId: string): Promise<void> {
  const call = httpsCallable<{ promotionCodeId: string }, unknown>(functions, "adminDeactivatePromotionCode");
  await call({ promotionCodeId });
}

export async function deleteCoupon(couponId: string): Promise<void> {
  const call = httpsCallable<{ couponId: string }, unknown>(functions, "adminDeleteCoupon");
  await call({ couponId });
}

export function formatDiscount(coupon: StripeCoupon): string {
  if (coupon.percent_off) return `${coupon.percent_off}% off`;
  if (coupon.amount_off) return `${(coupon.amount_off / 100).toFixed(2)} ${(coupon.currency ?? "usd").toUpperCase()} off`;
  return "—";
}

export function formatDuration(coupon: StripeCoupon): string {
  if (coupon.duration === "repeating") return `${coupon.duration_in_months} month${coupon.duration_in_months === 1 ? "" : "s"}`;
  return coupon.duration;
}
