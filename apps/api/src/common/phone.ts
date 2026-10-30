const digits = (s: string) => s.replace(/\D/g, "");

/** Compares phone numbers by their last 10 digits, so "+91 98765 43210" matches "9876543210". */
export function samePhone(a: string, b: string): boolean {
  return digits(a).length >= 7 && digits(a).slice(-10) === digits(b).slice(-10);
}
