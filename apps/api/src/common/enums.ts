export const BUSINESS_TYPES = ["HOTEL", "SALON", "PARLOUR", "DOCTOR", "RESTAURANT", "OTHER"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Features a business can switch on. Appointments cover salons, parlours, doctors and hotel stays; dining covers QR tables. */
export const MODULES = ["APPOINTMENTS", "DINING"] as const;
export type ModuleName = (typeof MODULES)[number];

export const DEFAULT_MODULES: Record<BusinessType, ModuleName[]> = {
  HOTEL: ["APPOINTMENTS", "DINING"],
  SALON: ["APPOINTMENTS"],
  PARLOUR: ["APPOINTMENTS"],
  DOCTOR: ["APPOINTMENTS"],
  RESTAURANT: ["DINING"],
  OTHER: ["APPOINTMENTS"],
};

/** What each role in a business may do (see BusinessAccess). */
export const ROLES = ["OWNER", "MANAGER", "RECEPTION", "PROVIDER", "KITCHEN"] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
/** Statuses that hold the time slot / room. */
export const ACTIVE_BOOKING = ["PENDING", "CONFIRMED"] as const;

export const SERVICE_MODES = ["SLOT", "STAY"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export const PAYMENT_METHODS = ["CASH", "UPI_QR", "RAZORPAY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** CREATED: waiting for the customer. PENDING_VERIFICATION: customer says they paid, staff must check. */
export const PAYMENT_STATUSES = ["CREATED", "PENDING_VERIFICATION", "PAID", "FAILED", "REJECTED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = ["PLACED", "PREPARING", "READY", "SERVED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const RESERVATION_STATUSES = ["REQUESTED", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
