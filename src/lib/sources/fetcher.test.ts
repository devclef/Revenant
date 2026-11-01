// Tests for the download helper (04-real-figures, R2).
//
// `download` is the one place that applies the allowed-host rule and maps every
// HTTP and transport outcome onto a SourceError with a fixed, neutral message.
// Every case here uses a stub Fetcher, so no test touches the network. The real
// `defaultFetcher` is only inspected structurally (it must set no header,
// credential or cookie), never invoked.

import { describe, expect, it } from "vitest";

import { SourceError } from "./errors";
import { ALLOWED_HOSTS, defaultFetcher, download } from "./fetcher";
import type { FetchResult, Fetcher } from "./types";

const PUBLISHER = "eia" as const;
const OK_HOST = "www.eia.gov";
const OK_URL = `https://${OK_HOST}/petroleum/series.xlsx`;
const OTHER_OK_HOST = "energy.ec.europa.eu";
const OTHER_OK_URL = `https://${OTHER_OK_HOST}/bulletin.xlsx`;

/** A body of `size` bytes (non-zero fill so byteLength alone decides). */
function bytes(size: number): Uint8Array {
  return new Uint8Array(size).fill(1);
}

/**
 * A stub Fetcher that returns a fixed result (status, final url, body) and
 * records the URL it was asked for. It never touches the network.
 */
function stubFetcher(result: FetchResult): { fetcher: Fetcher; calledWith: string[] } {
  const calledWith: string[] = [];
  const fetcher: Fetcher = async (url: string) => {
    calledWith.push(url);
    return result;
  };
  return { fetcher, calledWith };
}

/** A stub Fetcher that throws, to exercise the `network` mapping. */
function throwingFetcher(message: string): { fetcher: Fetcher; calledWith: string[] } {
  const calledWith: string[] = [];
  const fetcher: Fetcher = async (url: string) => {
    calledWith.push(url);
    throw new Error(message);
  };
  return { fetcher, calledWith };
}

describe("download (R2)", () => {
  it("returns the result unchanged on 200 with a non-empty body", async () => {
    const result: FetchResult = { status: 200, url: OK_URL, body: bytes(1024) };
    const { fetcher, calledWith } = stubFetcher(result);

    const got = await download(fetcher, OK_URL, PUBLISHER);

    expect(got.status).toBe(200);
    expect(got.url).toBe(OK_URL);
    expect(got.body.byteLength).toBe(1024);
    expect(calledWith).toEqual([OK_URL]);
  });

  describe("auth statuses map to auth_required", () => {
    for (const status of [401, 403, 407]) {
      it(`maps ${status} to auth_required`, async () => {
        const { fetcher } = stubFetcher({ status, url: OK_URL, body: bytes(10) });
        try {
          await download(fetcher, OK_URL, PUBLISHER);
          expect.unreachable("download should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(SourceError);
          const e = error as SourceError;
          expect(e.kind).toBe("auth_required");
          expect(e.publisher).toBe(PUBLISHER);
          expect(e.message).toContain(String(status));
        }
      });
    }
  });

  describe("other non-2xx statuses map to http_status", () => {
    for (const status of [404, 500, 301, 199]) {
      it(`maps ${status} to http_status`, async () => {
        const { fetcher } = stubFetcher({ status, url: OK_URL, body: bytes(10) });
        try {
          await download(fetcher, OK_URL, PUBLISHER);
          expect.unreachable("download should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(SourceError);
          const e = error as SourceError;
          expect(e.kind).toBe("http_status");
          expect(e.message).toContain(String(status));
        }
      });
    }
  });

  it("maps a thrown fetcher to network, naming publisher and URL but NOT the underlying message", async () => {
    const underlying = "ECONNREFUSED 10.0.0.1:443 secret-internal-host";
    const { fetcher } = throwingFetcher(underlying);

    try {
      await download(fetcher, OK_URL, PUBLISHER);
      expect.unreachable("download should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      const e = error as SourceError;
      expect(e.kind).toBe("network");
      expect(e.publisher).toBe(PUBLISHER);
      expect(e.message).toContain(OK_URL);
      // The library's own message must never leak into the neutral error.
      expect(e.message).not.toContain("ECONNREFUSED");
      expect(e.message).not.toContain("10.0.0.1");
      expect(e.message).not.toContain("secret-internal-host");
      expect(e.message).not.toContain(underlying);
    }
  });

  it("maps a zero-byte body to empty_body", async () => {
    const { fetcher } = stubFetcher({ status: 200, url: OK_URL, body: bytes(0) });
    try {
      await download(fetcher, OK_URL, PUBLISHER);
      expect.unreachable("download should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      expect((error as SourceError).kind).toBe("empty_body");
    }
  });

  it("maps a body over 20 MB to unreadable_file", async () => {
    const tooBig = 20 * 1024 * 1024 + 1;
    const { fetcher } = stubFetcher({ status: 200, url: OK_URL, body: bytes(tooBig) });
    try {
      await download(fetcher, OK_URL, PUBLISHER);
      expect.unreachable("download should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      expect((error as SourceError).kind).toBe("unreadable_file");
    }
  });

  it("accepts a body at exactly 20 MB", async () => {
    const exactly = 20 * 1024 * 1024;
    const { fetcher } = stubFetcher({ status: 200, url: OK_URL, body: bytes(exactly) });
    const got = await download(fetcher, OK_URL, PUBLISHER);
    expect(got.body.byteLength).toBe(exactly);
  });

  describe("wrong host (R2.5)", () => {
    it("refuses a disallowed initial request host before calling the fetcher", async () => {
      const badUrl = "https://evil.example.com/petroleum/series.xlsx";
      // A stub that would otherwise succeed; it must never be called.
      const { fetcher, calledWith } = stubFetcher({
        status: 200,
        url: badUrl,
        body: bytes(10),
      });

      try {
        await download(fetcher, badUrl, PUBLISHER);
        expect.unreachable("download should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SourceError);
        const e = error as SourceError;
        expect(e.kind).toBe("wrong_host");
        expect(e.message).toContain(badUrl);
      }
      expect(calledWith).toEqual([]);
    });

    it("refuses an unparseable initial request URL", async () => {
      const { fetcher, calledWith } = stubFetcher({
        status: 200,
        url: OK_URL,
        body: bytes(10),
      });
      try {
        await download(fetcher, "not a url", PUBLISHER);
        expect.unreachable("download should have thrown");
      } catch (error) {
        expect((error as SourceError).kind).toBe("wrong_host");
      }
      expect(calledWith).toEqual([]);
    });

    it("refuses when a redirect lands the final URL on another host", async () => {
      const redirectedUrl = "https://evil.example.com/landing";
      // Initial URL is allowed; the fetcher reports a final URL on a bad host.
      const { fetcher, calledWith } = stubFetcher({
        status: 200,
        url: redirectedUrl,
        body: bytes(10),
      });

      try {
        await download(fetcher, OK_URL, PUBLISHER);
        expect.unreachable("download should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SourceError);
        const e = error as SourceError;
        expect(e.kind).toBe("wrong_host");
        // The message names the final (redirected) URL, not the request URL.
        expect(e.message).toContain(redirectedUrl);
      }
      // The fetcher was still called with the (allowed) initial URL.
      expect(calledWith).toEqual([OK_URL]);
    });

    it("allows a redirect between two allowed hosts", async () => {
      const { fetcher } = stubFetcher({
        status: 200,
        url: OTHER_OK_URL,
        body: bytes(10),
      });
      const got = await download(fetcher, OK_URL, PUBLISHER);
      expect(got.url).toBe(OTHER_OK_URL);
    });

    it("checks the host before the status, so a disallowed host never reaches status mapping", async () => {
      const badUrl = "https://evil.example.com/x";
      const { fetcher } = stubFetcher({ status: 404, url: badUrl, body: bytes(10) });
      try {
        await download(fetcher, badUrl, PUBLISHER);
        expect.unreachable("download should have thrown");
      } catch (error) {
        expect((error as SourceError).kind).toBe("wrong_host");
      }
    });
  });

  it("exposes the allowed hosts and keeps them to the two publishers", () => {
    expect([...ALLOWED_HOSTS]).toEqual([OK_HOST, OTHER_OK_HOST]);
  });
});

describe("defaultFetcher (structural, no network)", () => {
  // We must not hit the network here. Instead we read the function's source to
  // assert it sets no header, credential or cookie and reads no environment
  // variable. This is a coarse but deterministic check that the real
  // downloader stays header/credential-free (R2.6).
  const source = defaultFetcher.toString();

  it("is a function", () => {
    expect(typeof defaultFetcher).toBe("function");
  });

  it("sends no credentials (credentials: 'omit')", () => {
    expect(source).toContain('credentials: "omit"');
    expect(source).not.toMatch(/credentials:\s*["']include["']/);
  });

  it("sets no request headers", () => {
    expect(source).not.toMatch(/\bheaders\b/);
  });

  it("sets no cookie", () => {
    expect(source.toLowerCase()).not.toContain("cookie");
  });

  it("reads no environment variable", () => {
    expect(source).not.toContain("process.env");
  });

  it("follows redirects", () => {
    expect(source).toContain('redirect: "follow"');
  });
});
