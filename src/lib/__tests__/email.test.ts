import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, type EmailPayload } from "../email";

describe("sendEmail abstraction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("development and test environments", () => {
    it("resolves without throwing in test environment", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const payload: EmailPayload = {
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test message</p>",
      };

      await expect(sendEmail(payload)).resolves.toBeUndefined();
    });

    it("does not make network requests and logs in development environment", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("EMAIL_PROVIDER", "");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const payload: EmailPayload = {
        to: "developer@example.com",
        subject: "Verification Email",
        html: "<p>Click here to verify</p>",
      };

      await expect(sendEmail(payload)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Email Stub]"),
        expect.objectContaining({ to: "developer@example.com" })
      );
    });
  });

  describe("production environment (fail-closed)", () => {
    it("throws if EMAIL_PROVIDER is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EMAIL_PROVIDER", "");

      const payload: EmailPayload = {
        to: "prod@example.com",
        subject: "Production Alert",
        html: "<p>Important notice</p>",
      };

      await expect(sendEmail(payload)).rejects.toThrowError(
        /EMAIL_PROVIDER is not configured in production environment/
      );
    });

    it("throws if EMAIL_PROVIDER is 'stub'", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EMAIL_PROVIDER", "stub");

      const payload: EmailPayload = {
        to: "prod@example.com",
        subject: "Production Alert",
        html: "<p>Important notice</p>",
      };

      await expect(sendEmail(payload)).rejects.toThrowError(
        /EMAIL_PROVIDER 'stub' is not permitted in production environment/
      );
    });

    it("throws if EMAIL_PROVIDER is an unsupported or unimplemented provider like 'resend'", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EMAIL_PROVIDER", "resend");

      const payload: EmailPayload = {
        to: "prod@example.com",
        subject: "Production Alert",
        html: "<p>Important notice</p>",
      };

      await expect(sendEmail(payload)).rejects.toThrowError(
        /EMAIL_PROVIDER 'resend' is not implemented/
      );
    });
  });
});
