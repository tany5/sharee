import type { DeliveryAddress } from "@/lib/types";

export type AddressErrors = Partial<Record<keyof DeliveryAddress, string>>;

/** Normalise an Indian mobile number: strips +91/0 prefixes and spaces. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^\+?91(?=[6-9])/, "").replace(/^0(?=[6-9])/, "");
}

export function validatePhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function validatePincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

/**
 * Validate + sanitize delivery details. Returns trimmed values in `address`
 * when valid, so the server stores exactly what it validated.
 */
export function validateAddress(
  raw: Partial<DeliveryAddress>,
): { ok: boolean; errors: AddressErrors; address?: DeliveryAddress } {
  const errors: AddressErrors = {};
  const fullName = raw.fullName?.trim() ?? "";
  const phone = raw.phone?.trim() ?? "";
  const pincode = raw.pincode?.trim() ?? "";
  const line1 = raw.line1?.trim() ?? "";
  const landmark = raw.landmark?.trim() ?? "";
  const city = raw.city?.trim() ?? "";
  const state = raw.state?.trim() ?? "";

  if (fullName.length < 2) errors.fullName = "Please enter your full name";
  if (!validatePhone(phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (!validatePincode(pincode)) errors.pincode = "Enter a valid 6-digit pincode";
  if (line1.length < 5) errors.line1 = "Please enter your full address";
  if (city.length < 2) errors.city = "Enter your city";
  if (state.length < 2) errors.state = "Select your state";

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors };
  return {
    ok,
    errors,
    address: { fullName, phone, pincode, line1, landmark, city, state },
  };
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;
