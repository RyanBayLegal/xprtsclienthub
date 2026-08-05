import { describe, expect, it } from "vitest";
import {
  buildMimeReport,
  cleanMessageBody,
  decideRender,
  decodeBase64Text,
  decodeQuotedPrintable,
  looksLikeBase64,
  normalizeCharset,
} from "@/lib/email-mime";
import { mimeFixtures } from "@/test/fixtures/mime";

describe("MIME renderer regression fixtures", () => {
  for (const fixture of mimeFixtures) {
    it(fixture.name, () => {
      const decision = decideRender({
        body: fixture.body,
        html: fixture.html,
        charset: fixture.charset,
      });
      expect(decision.mode).toBe(fixture.expectMode);
      for (const needle of fixture.expectContains || []) {
        expect(decision.text).toContain(needle);
      }
      for (const needle of fixture.expectNotContains || []) {
        expect(decision.text).not.toContain(needle);
      }
    });
  }
});

describe("charset handling", () => {
  it("normalizes common Gmail charset aliases", () => {
    expect(normalizeCharset("UTF8")).toBe("utf-8");
    expect(normalizeCharset("\"cp1252\"")).toBe("windows-1252");
    expect(normalizeCharset("Latin1")).toBe("iso-8859-1");
    expect(normalizeCharset(null)).toBe("utf-8");
  });

  it("decodes base64 utf-8 payloads", () => {
    expect(decodeBase64Text(btoa("héllo wörld"))).toContain("llo w");
  });

  it("returns the input when base64 is invalid", () => {
    expect(decodeBase64Text("not base64 !!!")).toBe("not base64 !!!");
  });
});

describe("helpers", () => {
  it("decodes quoted-printable soft breaks", () => {
    expect(decodeQuotedPrintable("a=\r\nb=20c")).toBe("ab c");
  });

  it("detects base64 blobs but not prose", () => {
    expect(looksLikeBase64(btoa("a".repeat(80)))).toBe(true);
    expect(looksLikeBase64("Hi Ryan, thanks for the note about the meeting.")).toBe(false);
  });

  it("strips MIME noise from stored bodies", () => {
    const cleaned = cleanMessageBody("Content-Type: text/plain\n\nHello there");
    expect(cleaned).toBe("Hello there");
  });
});

describe("mime report export", () => {
  it("captures renderer decisions and parts", () => {
    const decision = decideRender({ body: "Hello", html: null });
    const report = buildMimeReport(
      { id: "in:1", subject: "Re: Hi", mimeParts: [{ type: "text/plain" }] },
      decision,
    );
    expect(report.renderer.mode).toBe("text");
    expect(report.mime_parts).toHaveLength(1);
    expect(report.renderer.rendered_text_preview).toBe("Hello");
  });

  it("surfaces the failing part path on parse errors", () => {
    const decision = decideRender({
      body: "",
      parseError: { message: "boundary not found", part_path: "1.2/text/plain" },
    });
    expect(decision.mode).toBe("error");
    expect(decision.failingPartPath).toBe("1.2/text/plain");
  });
});
