import { describe, it, expect } from "vitest";
import { redactMessage, isLuhnValid } from "../src/logs";

describe("logs PII redaction", () => {
  it("validates credit card numbers with Luhn algorithm", () => {
    // Standard test Visa number
    expect(isLuhnValid("4532015112830366")).toBe(true);
    // Invalid card number (fails checksum)
    expect(isLuhnValid("4532015112830367")).toBe(false);
    // Too short
    expect(isLuhnValid("123456789")).toBe(false);
  });

  it("redacts valid credit card numbers with spaces or dashes", () => {
    const raw = "Charged card 4532-0151-1283-0366 for order 12345";
    expect(redactMessage(raw)).toBe("Charged card [redacted-card] for order 12345");
  });

  it("redacts email addresses", () => {
    const raw = "Failed login attempt for user alice.smith+test@example.com from IP";
    expect(redactMessage(raw)).toBe("Failed login attempt for user [redacted-email] from IP");
  });

  it("redacts phone numbers", () => {
    const raw = "Customer service contacted +1 (555) 234-5678 regarding order";
    expect(redactMessage(raw)).toBe("Customer service contacted [redacted-phone] regarding order");
  });

  it("redacts SSNs", () => {
    const raw = "Tax ID: 000-12-3456 verified";
    expect(redactMessage(raw)).toBe("Tax ID: [redacted-ssn] verified");
  });

  it("redacts passwords, tokens, and bearer auth headers", () => {
    const raw = 'Auth: Bearer secret_token_xyz, password: "superSecretPassword123"';
    expect(redactMessage(raw)).toBe('Auth: Bearer [redacted], password: [redacted]');
  });
});
