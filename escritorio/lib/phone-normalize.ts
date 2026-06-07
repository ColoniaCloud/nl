// Ordered longest-first so "1809" is tried before "1", etc.
const DIAL_CODES: [string, string[]][] = [
  ["1809", ["república dominicana", "republica dominicana", "dominicana", "dominican republic", "rd"]],
  ["598",  ["uruguay", "uy"]],
  ["593",  ["ecuador", "ec"]],
  ["595",  ["paraguay", "py"]],
  ["591",  ["bolivia", "bo"]],
  ["507",  ["panamá", "panama", "pa"]],
  ["506",  ["costa rica", "cr"]],
  ["505",  ["nicaragua", "ni"]],
  ["504",  ["honduras", "hn"]],
  ["503",  ["el salvador", "sv"]],
  ["502",  ["guatemala", "gt"]],
  ["351",  ["portugal", "pt"]],
  ["34",   ["españa", "spain", "es"]],
  ["58",   ["venezuela", "ve"]],
  ["57",   ["colombia", "co"]],
  ["56",   ["chile", "cl"]],
  ["55",   ["brasil", "brazil", "br"]],
  ["54",   ["argentina", "ar"]],
  ["53",   ["cuba", "cu"]],
  ["52",   ["méxico", "mexico", "mx"]],
  ["51",   ["perú", "peru", "pe"]],
  ["1",    ["estados unidos", "united states", "usa", "us", "canada", "ca"]],
];

function dialCodeFromPais(pais: string | null | undefined): string | null {
  if (!pais) return null;
  const norm = pais.toLowerCase().trim();
  for (const [code, names] of DIAL_CODES) {
    if (names.includes(norm)) return code;
  }
  return null;
}

function isMobile(local: string, code: string): boolean {
  switch (code) {
    // Argentina: 10 digits, OR 11 digits starting with 9 (international +54 9 XX...)
    case "54":
      return local.length === 10 || (local.length === 11 && local[0] === "9");
    case "55":   // Brazil: area(2) + leading 9 + 8 digits = 11 total
      return local.length === 11 && local[2] === "9";
    // Mexico: 10 digits (new format), or 11 digits starting with 1 (old +521... format)
    case "52":
      return local.length === 10 || (local.length === 11 && local[0] === "1");
    case "57":   // Colombia: starts with 3, 10 digits
      return local.length === 10 && local[0] === "3";
    case "56":   // Chile: starts with 9, 9 digits
      return local.length === 9 && local[0] === "9";
    case "51":   // Peru: starts with 9, 9 digits
      return local.length === 9 && local[0] === "9";
    case "598":  // Uruguay: starts with 9, 8 digits
      return local.length === 8 && local[0] === "9";
    case "58":   // Venezuela: starts with 4, 10 digits
      return local.length === 10 && local[0] === "4";
    case "593":  // Ecuador: starts with 9, 9 digits
      return local.length === 9 && local[0] === "9";
    case "591":  // Bolivia: starts with 6 or 7, 8 digits
      return local.length === 8 && (local[0] === "6" || local[0] === "7");
    case "595":  // Paraguay: starts with 9, 9 digits
      return local.length === 9 && local[0] === "9";
    case "507":  // Panama: starts with 6, 8 digits
      return local.length === 8 && local[0] === "6";
    case "506":  // Costa Rica: 8 digits starting with 5,6,7,8
      return local.length === 8 && "5678".includes(local[0]);
    case "502":  // Guatemala: 8 digits starting with 3,4,5
      return local.length === 8 && "345".includes(local[0]);
    case "505":  // Nicaragua: 8 digits starting with 5,6,7,8
      return local.length === 8 && "5678".includes(local[0]);
    case "504":  // Honduras: 8 digits starting with 3,7,8,9
      return local.length === 8 && "3789".includes(local[0]);
    case "503":  // El Salvador: 8 digits starting with 6,7
      return local.length === 8 && (local[0] === "6" || local[0] === "7");
    case "1809":
    case "1":
      return local.length === 10;
    default:
      return local.length >= 7;
  }
}

/** Strips the leading 0 (national trunk prefix) used across LATAM. */
function stripTrunk(digits: string): string {
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/** Builds the WhatsApp JID with country-specific normalization. */
function buildJid(code: string, local: string): string {
  // Argentina: JID = 549XXXXXXXXXX. Add 9 only if not already present.
  if (code === "54") {
    const clean = local.startsWith("9") ? local.slice(1) : local;
    return `549${clean}@s.whatsapp.net`;
  }
  // Mexico old format +521XXXXXXXXXX → strip the leading 1, JID = 52XXXXXXXXXX
  if (code === "52" && local.length === 11 && local[0] === "1") {
    return `52${local.slice(1)}@s.whatsapp.net`;
  }
  return `${code}${local}@s.whatsapp.net`;
}

export interface PhoneResolution {
  jid: string | null;
  compatible: boolean;
}

/**
 * Normalizes a raw phone string and determines WhatsApp (mobile) compatibility.
 *
 * Strategy:
 *  1. If number has explicit international prefix (+ or 00) → parse country code
 *  2. Otherwise treat as local format: use `pais` to get code, strip trunk 0
 *  3. Fallback: if 10+ digits with no country info, assume compatible
 */
export function resolveWaPhone(
  phone: string | null | undefined,
  pais: string | null | undefined
): PhoneResolution {
  if (!phone) return { jid: null, compatible: false };

  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return { jid: null, compatible: false };

  const isInternational = trimmed.startsWith("+") || trimmed.startsWith("00");

  // ── International format (has + or 00) ───────────────────────────────────
  if (isInternational) {
    const d = trimmed.startsWith("00") ? digits.slice(2) : digits;
    for (const [code] of DIAL_CODES) {
      if (!d.startsWith(code)) continue;
      const local = d.slice(code.length);
      if (local.length < 6 || local.length > 12) continue;
      const mobile = isMobile(local, code);
      if (!mobile) return { jid: null, compatible: false };
      return { jid: buildJid(code, local), compatible: true };
    }
    // International but unknown country — allow if long enough
    return d.length >= 10
      ? { jid: `${d}@s.whatsapp.net`, compatible: true }
      : { jid: null, compatible: false };
  }

  // ── Local format — rely on pais ──────────────────────────────────────────
  const code = dialCodeFromPais(pais);
  if (code) {
    const local = stripTrunk(digits);
    const mobile = isMobile(local, code);
    if (!mobile) return { jid: null, compatible: false };
    return { jid: buildJid(code, local), compatible: true };
  }

  // ── No country info — fallback ───────────────────────────────────────────
  const local = stripTrunk(digits);
  if (local.length >= 10) {
    return { jid: `${local}@s.whatsapp.net`, compatible: true };
  }

  return { jid: null, compatible: false };
}
