export const bookingStatusLabel: Record<string, string> = {
  pending_payment: "Čeká na platbu",
  confirmed: "Potvrzeno",
  waitlist: "Pořadník",
  cancelled: "Zrušeno",
  attended: "Účast",
  no_show: "Nedorazil/a",
};

export const methodLabel: Record<string, string> = {
  credits: "Kredit",
  pass: "Permanentka",
  membership: "Členství",
  free: "Vstup zdarma",
  drop_in: "Jednorázově",
  free_class: "Lekce zdarma",
  admin: "Recepce",
};

export const orderStatusLabel: Record<string, string> = {
  pending: "Čeká na platbu",
  paid: "Zaplaceno",
  cancelled: "Zrušeno",
  expired: "Vypršelo",
  refunded: "Vráceno",
};

export const creditReasonLabel: Record<string, string> = {
  purchase: "Nákup",
  booking: "Rezervace",
  refund: "Vrácení",
  admin: "Úprava recepcí",
  bonus: "Bonus",
};

export const entitlementKindLabel: Record<string, string> = {
  pass: "Permanentka",
  membership: "Členství",
  free: "Vstup zdarma",
};

export const productKindLabel: Record<string, string> = {
  credit_pack: "Kredit",
  pass: "Permanentka",
  membership: "Členství",
};
