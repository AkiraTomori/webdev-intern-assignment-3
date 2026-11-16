import { z } from "zod";

// The one SBD rule (B1 §8 q3): exactly 8 digits, always a string (leading zeros are data).
// Mirrors CHECK candidates_sbd_format_chk. The seeder and the lookup API both use this.
export const sbdSchema = z.string().regex(/^\d{8}$/);
