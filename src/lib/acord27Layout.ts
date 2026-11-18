/**
 * ACORD 27 (2006/07 edition, "Evidence Of Property Ins.pdf") box layout: which PDF field holds which detail.
 * The fillable PDF uses generic field names (LOC, COVERAGE1, CASymbols212...), mapped here from their printed labels.
 * Used to turn the AI's reading of the user's own information into a filled training sample.
 */

export interface Acord27Coverage { description?: string; amount?: string; deductible?: string }

/** What the AI extracts from the user's question, notes and photos (see acord27Prompt in api/chat.ts). */
export interface Acord27Data {
  issue_date?: string;
  agency_name_address?: string;
  agency_phone?: string;
  agency_fax?: string;
  agency_email?: string;
  agency_code?: string;
  agency_subcode?: string;
  agency_customer_id?: string;
  company_name_address?: string;
  insured_name_address?: string;
  loan_number?: string;
  policy_number?: string;
  effective_date?: string;
  expiration_date?: string;
  continued_until_terminated?: boolean;
  replaces_prior_evidence_dated?: string;
  property_location_description?: string;
  coverages?: Acord27Coverage[];
  remarks?: string;
  cancellation_notice_days?: string | number;
  additional_interest_name_address?: string;
  interest_mortgagee?: boolean;
  interest_additional_insured?: boolean;
  interest_loss_payee?: boolean;
  interest_other?: string;
  additional_interest_loan_number?: string;
  authorized_representative?: string;
  summary?: string;
  missing?: string[];
}

/** Text boxes: data key -> PDF field (short name, after the "F[0].P1[0]." prefix). */
const TEXT_FIELDS: Partial<Record<keyof Acord27Data, string>> = {
  issue_date: 'Date2[0]',
  agency_name_address: 'COVERAGE1[0]',
  agency_phone: 'Phone[0]',
  agency_fax: 'Fax[0]',
  agency_email: 'LOC[0]',
  agency_code: 'LOC1[0]',
  agency_subcode: 'LOC2[0]',
  agency_customer_id: 'LOC3[0]',
  company_name_address: 'Company[0]',
  insured_name_address: 'COVERAGE12[0]',
  loan_number: 'LOC4[0]',
  policy_number: 'LOC5[0]',
  effective_date: 'Date[0]',
  expiration_date: 'Date1[0]',
  replaces_prior_evidence_dated: 'Date3[0]',
  property_location_description: 'COVERAGE11[0]',
  remarks: 'remarks[0]',
  cancellation_notice_days: 'NOAUTOS[0]',
  additional_interest_name_address: 'addlint[0]',
  interest_other: 'LOC6[0]',
  additional_interest_loan_number: 'LOC7[0]',
};

/** Check boxes: data key -> PDF field. */
const CHECK_FIELDS: Partial<Record<keyof Acord27Data, string>> = {
  continued_until_terminated: 'CASymbols214[0]',
  interest_mortgagee: 'CASymbols212[0]',
  interest_additional_insured: 'CASymbols21[0]',
  interest_loss_payee: 'CASymbols213[0]',
};

const COVERAGE_ROWS = 8;

/** Where the "Authorized Representative" name is printed (this edition has no field there). PDF points, page 1. */
export const AUTHORIZED_REP_STAMP = { x: 470, y: 60, size: 10 };

const shortName = (full: string) => full.replace(/^.*?P1\[0\]\./, '');

/**
 * Turns extracted data into { fullPdfFieldName: value } for the uploaded PDF.
 * Returns null when the PDF isn't the supported ACORD 27 edition.
 */
export function acord27ToFieldValues(data: Acord27Data, pdfFieldNames: string[]): Record<string, string> | null {
  const byShort = new Map(pdfFieldNames.map((n) => [shortName(n), n]));
  if (!byShort.has('COVERAGE1[0]') || !byShort.has('addlint[0]') || !byShort.has('covperils1[0]')) return null;

  const values: Record<string, string> = {};
  const put = (short: string, value: unknown) => {
    const full = byShort.get(short);
    const text = value == null ? '' : String(value).trim();
    if (full && text) values[full] = text;
  };
  for (const [key, short] of Object.entries(TEXT_FIELDS)) put(short as string, data[key as keyof Acord27Data]);
  for (const [key, short] of Object.entries(CHECK_FIELDS)) if (data[key as keyof Acord27Data] === true) put(short as string, 'true');
  if (data.interest_other) put('CASymbols211[0]', 'true');
  (data.coverages ?? []).slice(0, COVERAGE_ROWS).forEach((c, i) => {
    put(`covperils1[${i}]`, c.description);
    put(`amtinsur[${i}]`, c.amount);
    put(`deduct[${i}]`, c.deductible);
  });
  return values;
}

/** Pulls the JSON object out of the AI's reply (tolerates stray text or code fences around it). */
export function parseAcord27Reply(reply: string): Acord27Data {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The assistant did not return the form details. Please try again.');
  const data = JSON.parse(reply.slice(start, end + 1)) as Acord27Data;
  if (typeof data !== 'object' || data === null) throw new Error('The assistant returned an unexpected answer. Please try again.');
  return data;
}
