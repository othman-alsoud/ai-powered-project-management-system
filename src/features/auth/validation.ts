import { z } from "zod";

/**
 * Schema for confirming permanent account deletion via anonymization.
 * Requires exact "DELETE" confirmation phrase and optional password
 * (enforced server-side when the account has a credential password).
 */
export const deleteAccountSchema = z.object({
  confirmationPhrase: z
    .string()
    .trim()
    .refine((val) => val === "DELETE", {
      message: 'Please type "DELETE" to confirm account deletion.',
    }),
  password: z.string().optional(),
});

export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
export type DeleteAccountOutput = z.output<typeof deleteAccountSchema>;
