import { z } from "zod";

/**
 * Zod schema for the sign-in form.
 *
 * Transformations applied before passing to Better Auth:
 *   - email: trimmed, lowercased
 *   - password: unchanged (never trim passwords)
 *   - rememberMe: optional boolean defaulting to false
 */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),

  rememberMe: z.boolean().default(false).optional(),
});

/** Raw input type (before Zod transforms). */
export type SignInInput = z.input<typeof signInSchema>;

/** Validated and transformed output type. */
export type SignInOutput = z.output<typeof signInSchema>;
