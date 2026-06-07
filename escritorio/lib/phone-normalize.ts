// Maps country names/codes (as stored in `pais` field) to E.164 dial codes
const COUNTRY_DIAL: Record<string, string> = {
  // Argentina
  argentina: "54", ar: "54",
  // Brazil
  brasil: "55", brazil: "55", br: "55",
  // Mexico
  "méxico": "52", mexico: "52", mx: "52",
  // Colombia
  colombia: "57", co: "57",
  // Chile
  chile: "56", cl: "56",
  // Peru
  "perú": "51", peru: "51", pe: "51",
  // Uruguay
  uruguay: "598", uy: "598",
  // Venezuela
  venezuela: "58", ve: "58",
  // Ecuador
  ecuador: "593", ec: "593",
  // Bolivia
  bolivia: "591", bo: "591",
  // Paraguay
  paraguay: "595", py: "595",
  // Panama
  "panamá": "507", panama: "507", pa: "507",
  // Costa Rica
  "costa rica": "506", cr: "506",
  // Guatemala
  guatemala: "502", gt: "502",
  // Honduras
  honduras: "504", hn: "504",
  // El Salvador
  "el salvador": "503", sv: "503",
  // Nicaragua
  nicaragua: "505", ni: "505",
  // Dominican Republic
  "república dominicana": "1809", "dominicana": "1809", do: "1809",
  // Cuba
  cuba: "53", cu: "53",
  // Spain
  "españa": "34", spain: "34", es: "34",
  // USA/Canada
  "estados unidos": "1", usa: "1", "united states": "1", us: "1",
  canada: "1", ca: "1",
};

function dialCode(pais: string | null | undefined): string | null {
  if (!pais) return null;
  return COUNTRY_DIAL[pais.toLowerCase().trim()] ?? null;
}

/**
 * Returns whether a phone number is a mobile (WhatsApp-compatible) number
 * given the digits WITHOUT country code and the dial code.
 */
function isMobileNumber(local: string, code: string): boolean {
  switch (code) {
    case "54": // Argentina: mobile = 10 digits
      return local.length === 10;
    case "55": // Brazil: area(2) + 9 + 8 digits = 11 digits total
      return local.length === 11 && local[2] === "9";
    case "52": // Mexico: mobile = 10 digits
      return local.length === 10;
    case "57": // Colombia: mobile starts with 3
      return local.length === 10 && local[0] === "3";
    case "56": // Chile: mobile starts with 9
      return local.length === 9 && local[0] === "9";
    case "51": // Peru: mobile starts with 9
      return local.length === 9 && local[0] === "9";
    case "598": // Uruguay: mobile starts with 09 → local starts with 9, 8 digits
      return local.length === 8 && local[0] === "9";
    case "58": // Venezuela: mobile starts with 04
      return local.length === 10 && local.startsWith("04");
    case "593": // Ecuador: mobile starts with 09 → local starts with 9, 9 digits
      return local.length === 9 && local[0] === "9";
    case "591": // Bolivia: mobile starts with 6 or 7
      return local.length === 8 && (local[0] === "6" || local[0] === "7");
    case "595": // Paraguay: mobile starts with 09 → local starts with 9, 8 digits
      return local.length === 9 && local[0] === "9";
    case "507": // Panama: mobile 8 digits starting with 6
      return local.length === 8 && local[0] === "6";
    case "506": // Costa Rica: mobile 8 digits starting with 5,6,7,8
      return local.length === 8 && "5678".includes(local[0]);
    case "502": // Guatemala: 8 digits starting with 3,4,5
      return local.length === 8 && "345".includes(local[0]);
    case "1809": case "1": // DomRep / USA: 10 digits
      return local.length === 10;
    default:
      // Fallback: if at least 8 local digits, assume mobile
      return local.length >= 8;
  }
}

/**
 * Builds the WhatsApp JID for a given E.164 number + dial code.
 * Argentina requires inserting a 9 after the country code.
 */
function buildJid(code: string, local: string): string {
  if (code === "54") return `549${local}@s.whatsapp.net`;
  return `${code}${local}@s.whatsapp.net`;
}

export interface PhoneResolution {
  jid: string | null;
  compatible: boolean;
}

/**
 * Normalizes a phone string and determines WhatsApp compatibility.
 * @param phone  Raw phone as stored in the CRM (any format)
 * @param pais   Country name/code as stored in the CRM (free text)
 */
export function resolveWaPhone(
  phone: string | null | undefined,
  pais: string | null | undefined
): PhoneResolution {
  if (!phone) return { jid: null, compatible: false };

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return { jid: null, compatible: false };

  const code = dialCode(pais);

  // ── Case 1: number already starts with a known country code ──────────────
  for (const [, dc] of Object.entries(COUNTRY_DIAL)) {
    if (!digits.startsWith(dc)) continue;
    const local = digits.slice(dc.length);
    const mobile = isMobileNumber(local, dc);
    if (!mobile) return { jid: null, compatible: false };
    return { jid: buildJid(dc, local), compatible: true };
  }

  // ── Case 2: country code known from `pais`, number has no prefix ─────────
  if (code) {
    const local = digits;
    const mobile = isMobileNumber(local, code);
    if (!mobile) return { jid: null, compatible: false };
    return { jid: buildJid(code, local), compatible: true };
  }

  // ── Case 3: no country info — assume compatible if 10+ digits ────────────
  if (digits.length >= 10) {
    return { jid: `${digits}@s.whatsapp.net`, compatible: true };
  }

  return { jid: null, compatible: false };
}
