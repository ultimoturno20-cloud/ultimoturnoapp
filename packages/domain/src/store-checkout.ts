export type StoreSettings = {
  enabled: boolean;
  reservationMinutes: number;
  pickup: boolean;
  shipping: boolean;
  paymentInstructions: string;
  contactInstructions: string;
};
export const defaultStoreSettings: StoreSettings = { enabled: false, reservationMinutes: 30, pickup: true, shipping: true, paymentInstructions: "", contactInstructions: "" };
export type StoreOrderInput = {
  idempotencyKey: string;
  customerName: string;
  email: string;
  phone: string;
  fulfillment: "pickup" | "shipping";
  address: string;
  lines: Array<{ inventoryItemId: string; quantity: number; expectedPriceArs: number }>;
};
export type StoreOrderReceipt = { reference: string; totalArs: number; expiresAt: string; paymentInstructions: string; contactInstructions: string; status: string };
