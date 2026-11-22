import { z } from "zod";

/**
 * Zod schema for the sign-up form.
 *
 * Transformations applied before passing to Better Auth:
 *   - name  : leading/trailing whitespace trimmed
 *   - email : leading/trailing whitespace trimmed, lowercased
 *   - password : unchanged (never trim passwords)
 */
export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});

/** Raw input type (before Zod transforms). */
export type SignUpInput = z.input<typeof signUpSchema>;

/** Validated and transformed output type. */
export type SignUpOutput = z.output<typeof signUpSchema>;
