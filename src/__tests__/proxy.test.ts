import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("Next.js Proxy Routing and Authentication Gate", () => {
  const BASE_URL = "http://localhost:3000";

  function createRequest(
    path: string,
    cookies: Record<string, string> = {}
  ): NextRequest {
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    return new NextRequest(new URL(path, BASE_URL), {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  }

  // 1. Redirect a request to /teams/{teamId} when no session cookie exists
  it("redirects unauthenticated requests to /teams/{teamId} to /sign-in with redirectTo", () => {
    const teamId = "123e4567-e89b-12d3-a456-426614174000";
    const req = createRequest(`/teams/${teamId}`);
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/sign-in");
    expect(redirectUrl.searchParams.get("redirectTo")).toBe(`/teams/${teamId}`);
  });

  // 2. Redirect a nested protected route when no session cookie exists
  it("redirects unauthenticated requests to nested protected routes (/teams/{teamId}/projects/{id}/tasks)", () => {
    const nestedPath = "/teams/team-uuid/projects/proj-uuid/tasks";
    const req = createRequest(nestedPath);
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/sign-in");
    expect(redirectUrl.searchParams.get("redirectTo")).toBe(nestedPath);
  });

  // 3. Allow requests through when better-auth.session_token exists
  it("allows requests to protected routes when better-auth.session_token cookie is present", () => {
    const req = createRequest("/teams/team-uuid", {
      "better-auth.session_token": "valid-dev-session-token",
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  // 4. Allow requests through when __Secure-better-auth.session_token exists
  it("allows requests to protected routes when __Secure-better-auth.session_token cookie is present", () => {
    const req = createRequest("/teams/team-uuid", {
      "__Secure-better-auth.session_token": "valid-prod-session-token",
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  // 5. Do not redirect /login, /register, or /
  it.each(["/", "/login", "/register"])(
    "does not redirect public route: %s when no session exists",
    (publicPath) => {
      const req = createRequest(publicPath);
      const res = proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  );

  // 6. Do not redirect /api/auth/*
  it.each([
    "/api/auth/session",
    "/api/auth/sign-in/email",
    "/api/auth/sign-up/email",
    "/api/auth/callback/google",
  ])(
    "does not redirect Better Auth API endpoint: %s when unauthenticated",
    (apiPath) => {
      const req = createRequest(apiPath);
      const res = proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  );

  // 7. Do not incorrectly treat /teams-evil or /dashboard-evil as protected routes
  it.each(["/teams-evil", "/dashboard-evil", "/teams_public", "/teamsite"])(
    "does not incorrectly treat prefix collision path %s as a protected route",
    (unprotectedPath) => {
      const req = createRequest(unprotectedPath);
      const res = proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  );

  // 8. Verify that redirectTo contains only the requested pathname and cannot become an external URL
  it("ensures redirectTo is strictly the relative pathname and cannot be injected as an external URL", () => {
    // Attempting query parameter injection or malicious path navigation
    const req = createRequest("/teams/123?external=https://malicious-site.com");
    const res = proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeDefined();

    const redirectUrl = new URL(location!);
    const redirectTo = redirectUrl.searchParams.get("redirectTo");

    // Must be exactly the internal relative pathname
    expect(redirectTo).toBe("/teams/123");
    // Verify it starts with a single slash and is NOT a protocol-relative or external URL
    expect(redirectTo?.startsWith("/")).toBe(true);
    expect(redirectTo?.startsWith("//")).toBe(false);
    expect(redirectTo?.includes("://")).toBe(false);
    expect(redirectTo?.includes("malicious-site.com")).toBe(false);
  });
});
