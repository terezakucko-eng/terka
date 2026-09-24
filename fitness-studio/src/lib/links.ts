import { site } from "@/config/site";

/** Short link – fits into an SMS. */
export const unsubscribeUrl = (token: string) => `${site.url}/o/${token}`;
/** RFC 8058 one-click endpoint for the List-Unsubscribe header. */
export const oneClickUnsubscribeUrl = (token: string) => `${site.url}/api/unsubscribe/${token}`;
