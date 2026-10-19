import { OAuth2Client } from "google-auth-library";
import { AppError } from "../lib/errors.js";

export interface GoogleProfile { sub: string; email: string; emailVerified: boolean; name: string; picture: string | null }
export interface GoogleVerifier { verify(credential: string): Promise<GoogleProfile> }

export class RealGoogleVerifier implements GoogleVerifier {
  private client = new OAuth2Client();
  constructor(private clientId: string) {}
  async verify(credential: string): Promise<GoogleProfile> {
    try {
      // verifyIdToken checks the signature, audience, issuer and expiry
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: this.clientId });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email) throw new Error("incomplete payload");
      return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name ?? p.email, picture: p.picture ?? null };
    } catch {
      throw new AppError("INVALID_CREDENTIALS", "Google sign-in could not be verified.");
    }
  }
}
