/**
 * Shared MIME decoding + renderer-decision logic for email threads.
 * Kept framework-free so the pipeline can be validated by regression tests.
 */

export interface MimePart {
  type: string;
  disposition?: string;
  filename?: string;
  content_id?: string | null;
  size?: number;
  charset?: string | null;
  path?: string;
  error?: string | null;
}

export interface DecodeInput {
  body: string | null;
  html?: string | null;
  charset?: string | null;
  mimeParts?: MimePart[];
  parseError?: { message: string; part_path?: string | null } | null;
}

export type RenderMode = "html" | "text" | "empty" | "error";

export interface RenderDecision {
  mode: RenderMode;
  reason: string;
  charset: string;
  decoders: string[];
  failingPartPath?: string | null;
  errorMessage?: string | null;
  text: string;
}

const BASE64_LINE = /^[A-Za-z0-9+/=\s]+$/;

export function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/** True when the payload is a bare base64 blob rather than readable text. */
export function looksLikeBase64(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 32) return false;
  if (!BASE64_LINE.test(value)) return false;
  if (compact.length % 4 !== 0) return false;
  // Readable prose almost always contains spaces or punctuation base64 lacks.
  return !/[ .,;:!?'"@]/.test(value.replace(/\s/g, " ").trim().slice(0, 200).replace(/ /g, ""));
}

function bytesToString(bytes: Uint8Array, charset: string): string {
  const candidates = [charset, "utf-8", "windows-1252", "iso-8859-1"];
  for (const label of candidates) {
    if (!label) continue;
    try {
      const decoded = new TextDecoder(normalizeCharset(label), { fatal: label === charset }).decode(bytes);
      if (decoded) return decoded;
    } catch {
      /* try next charset */
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Maps the loose charset labels Gmail emits onto TextDecoder labels. */
export function normalizeCharset(charset?: string | null): string {
  const value = (charset || "").trim().toLowerCase().replace(/^["']|["']$/g, "");
  if (!value) return "utf-8";
  const aliases: Record<string, string> = {
    "utf8": "utf-8",
    "utf-8": "utf-8",
    "us-ascii": "utf-8",
    "ascii": "utf-8",
    "ansi_x3.4-1968": "utf-8",
    "cp1252": "windows-1252",
    "win-1252": "windows-1252",
    "windows-1252": "windows-1252",
    "latin1": "iso-8859-1",
    "iso8859-1": "iso-8859-1",
    "iso-8859-1": "iso-8859-1",
    "ks_c_5601-1987": "euc-kr",
    "gb2312": "gbk",
    "utf-7": "utf-8",
  };
  return aliases[value] || value;
}

export function decodeBase64Text(value: string, charset?: string | null): string {
  const compact = value.replace(/\s+/g, "");
  try {
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return bytesToString(bytes, normalizeCharset(charset));
  } catch {
    return value;
  }
}

/**
 * Normalises a stored plain-text body: strips leftover MIME headers/boundaries
 * and decodes quoted-printable or base64 payloads with the right charset.
 */
export function cleanMessageBody(value: string | null, charset?: string | null): string {
  if (!value) return "";
  let body = value.replace(/\r\n/g, "\n");

  if (/^--[-=\w]+\s*$/m.test(body) || /Content-(?:Type|Transfer-Encoding):/i.test(body)) {
    const detected = body.match(/charset=["']?([\w-]+)/i)?.[1];
    if (detected && !charset) charset = detected;
    const candidates = body.split(/^--[-=\w]+(?:--)?\s*$/m);
    const plain = candidates.find((part) => /Content-Type:\s*text\/plain/i.test(part));
    const chosen = plain || candidates.find((part) => !/Content-Type:\s*text\/html/i.test(part)) || body;
    const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(chosen);
    body = chosen.replace(/^[\s\S]*?\n\n/, "");
    if (isBase64) body = decodeBase64Text(body, charset);
  }

  if (looksLikeBase64(body)) body = decodeBase64Text(body, charset);

  return body
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/^Content-(?:Type|Transfer-Encoding|Disposition|ID):.*$/gim, "")
    .replace(/^--[-=\w]+(?:--)?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Decides how a message should be rendered and records why, for debugging. */
export function decideRender(input: DecodeInput): RenderDecision {
  const charset = normalizeCharset(input.charset);
  const decoders: string[] = [];
  const raw = input.body || "";

  if (input.parseError) {
    return {
      mode: "error",
      reason: "The backend MIME parser reported a failure for this message.",
      charset,
      decoders,
      failingPartPath: input.parseError.part_path || null,
      errorMessage: input.parseError.message,
      text: "",
    };
  }

  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(raw) || /=[0-9A-F]{2}/i.test(raw)) {
    decoders.push("quoted-printable");
  }
  if (looksLikeBase64(raw)) decoders.push(`base64 → ${charset}`);

  const text = cleanMessageBody(raw, input.charset);
  const html = (input.html || "").trim();

  if (html) {
    decoders.push("sanitize-html");
    return { mode: "html", reason: "A text/html part was present and rendered after sanitising.", charset, decoders, text };
  }
  if (text) {
    return { mode: "text", reason: "No HTML part, rendered the decoded text/plain part.", charset, decoders, text };
  }
  if (raw.trim() || (input.mimeParts || []).length) {
    return {
      mode: "error",
      reason: "MIME parts were detected but no readable text or HTML part could be decoded.",
      charset,
      decoders,
      failingPartPath: (input.mimeParts || []).find((p) => p.type?.startsWith("text/"))?.path || "body[text]",
      errorMessage: "Decoding produced an empty body.",
      text: "",
    };
  }
  return { mode: "empty", reason: "The message has no body content.", charset, decoders, text: "" };
}

/** Serialisable debug bundle used by the “Export MIME JSON” action. */
export function buildMimeReport(message: {
  id: string;
  subject?: string | null;
  address?: string;
  at?: string;
  messageId?: string | null;
  mimeParts?: MimePart[];
  attachments?: { name: string; type?: string; size?: number; disposition?: string; contentId?: string | null }[];
  raw?: string | null;
}, decision: RenderDecision) {
  return {
    exported_at: new Date().toISOString(),
    message: {
      id: message.id,
      message_id: message.messageId || null,
      subject: message.subject || null,
      address: message.address || null,
      sent_at: message.at || null,
    },
    mime_parts: message.mimeParts || [],
    attachments: (message.attachments || []).map((a) => ({
      name: a.name, type: a.type || null, size: a.size ?? null,
      disposition: a.disposition || null, content_id: a.contentId || null,
    })),
    renderer: {
      mode: decision.mode,
      reason: decision.reason,
      charset: decision.charset,
      decoders: decision.decoders,
      failing_part_path: decision.failingPartPath ?? null,
      error: decision.errorMessage ?? null,
      rendered_text_preview: decision.text.slice(0, 500),
    },
    raw_source: message.raw || null,
  };
}
