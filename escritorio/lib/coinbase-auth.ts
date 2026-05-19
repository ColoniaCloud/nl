import { SignJWT, importPKCS8 } from "jose";
import { randomBytes } from "crypto";

const KEY_NAME = process.env.COINBASE_KEY_NAME!;
const PRIVATE_KEY_PEM = process.env.COINBASE_PRIVATE_KEY!;

/**
 * Generates a signed JWT for Coinbase Commerce CDP API authentication.
 * https://docs.cdp.coinbase.com/commerce-onchain/docs/api-key-authentication
 */
export async function coinbaseAuthHeader(
  method: string,
  path: string
): Promise<Record<string, string>> {
  const pem = PRIVATE_KEY_PEM.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pem, "ES256");

  const nonce = randomBytes(16).toString("hex");
  const uri = `${method.toUpperCase()} ${path}`;

  const jwt = await new SignJWT({ sub: KEY_NAME, iss: "cdp", uri })
    .setProtectedHeader({ alg: "ES256", kid: KEY_NAME, nonce })
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("2m")
    .sign(privateKey);

  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
}
