import { createHash, randomBytes } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** 256-bit session token (raw value goes in the cookie, only its hash is stored). */
export const newSessionToken = () => randomBytes(32).toString("base64url");
/** 128-bit share token, URL safe. */
export const newShareToken = () => randomBytes(16).toString("base64url");
