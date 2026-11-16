import type vi from "./messages/vi.json";
import type { Locale } from "./i18n/config";

// vi is the source of truth: a wrong message key fails `tsc` (design F0 §4.2).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof vi;
  }
}
