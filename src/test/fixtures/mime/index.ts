/**
 * Saved failing MIME examples captured from real Gmail threads.
 * Add a new entry here whenever a message renders incorrectly — the regression
 * suite in src/lib/__tests__/email-mime.test.ts validates every entry.
 */
export interface MimeFixture {
  name: string;
  body: string;
  html?: string | null;
  charset?: string | null;
  expectMode: "html" | "text" | "error" | "empty";
  expectContains?: string[];
  expectNotContains?: string[];
}

export const mimeFixtures: MimeFixture[] = [
  {
    name: "nested multipart with raw headers leaking (image-27)",
    body: [
      "--000000000000abcd",
      "Content-Type: text/plain; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Hi Ryan,",
      "",
      "Thanks for the follow up =E2=80=94 next week works.",
      "--000000000000abcd",
      "Content-Type: text/html; charset=\"UTF-8\"",
      "",
      "<p>Hi Ryan</p>",
      "--000000000000abcd--",
    ].join("\r\n"),
    expectMode: "text",
    expectContains: ["Hi Ryan,", "next week works"],
    expectNotContains: ["Content-Type", "--000000000000abcd", "=E2=80=94"],
  },
  {
    name: "bare base64 payload (image-28)",
    body: btoa("Hello Ryan,\n\nAttaching the signed agreement now.\n\nBest,\nNicole").replace(/(.{60})/g, "$1\n"),
    expectMode: "text",
    expectContains: ["Attaching the signed agreement", "Nicole"],
    expectNotContains: ["SGVsbG8"],
  },
  {
    name: "base64 part declared as windows-1252",
    body: [
      "Content-Type: text/plain; charset=windows-1252",
      "Content-Transfer-Encoding: base64",
      "",
      btoa("Caf\xe9 meeting confirmed \x96 see you then."),
    ].join("\n"),
    charset: "windows-1252",
    expectMode: "text",
    expectContains: ["Caf", "meeting confirmed"],
    expectNotContains: ["Content-Transfer-Encoding"],
  },
  {
    name: "html part wins over plain text",
    body: "Plain fallback",
    html: "<p>Hello <a href=\"https://xprts.com\">team</a></p>",
    expectMode: "html",
  },
  {
    name: "empty body with parts reports a render error",
    body: "   ",
    expectMode: "empty",
  },
];
