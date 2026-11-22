export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Shared email delivery abstraction for transactional and auth-related emails.
 *
 * In development and test environments, emails are logged to console and not dispatched.
 * In production, the system fails closed and throws unless a real, implemented provider is available.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  const provider = process.env.EMAIL_PROVIDER;

  if (isProduction) {
    if (!provider) {
      throw new Error(
        "EMAIL_PROVIDER is not configured in production environment."
      );
    }

    if (provider === "stub") {
      throw new Error(
        "EMAIL_PROVIDER 'stub' is not permitted in production environment."
      );
    }

    // Fail closed: no real email provider driver is currently implemented.
    throw new Error(
      `EMAIL_PROVIDER '${provider}' is not implemented. Production email delivery is currently unavailable.`
    );
  }

  // Development and test stub behavior
  console.log("[Email Stub] Dispatching mock email:", {
    to: payload.to,
    subject: payload.subject,
  });
}
