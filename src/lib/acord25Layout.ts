/**
 * ACORD 25 (2016/03 edition, "ACORD 25 Certificate of Liability Insurance.pdf") box layout: which PDF field holds which
 * detail. This edition uses the standard ACORD field names (Producer_FullName_A, ...).
 * Used to turn the AI's reading of the user's own information into a filled training sample.
 * The keys must match acord25Prompt() in api/chat.ts.
 */

type YN = 'Y' | 'N' | string;

/** What the AI extracts from the user's question, notes and photos (see acord25Prompt in api/chat.ts). */
export interface Acord25Data {
  issue_date?: string;
  producer_name?: string; producer_address1?: string; producer_address2?: string; producer_city?: string; producer_state?: string; producer_zip?: string;
  producer_contact_name?: string; producer_phone?: string; producer_fax?: string; producer_email?: string;
  insured_name?: string; insured_address1?: string; insured_address2?: string; insured_city?: string; insured_state?: string; insured_zip?: string;
  insurers?: { letter?: string; name?: string; naic?: string }[];
  certificate_number?: string; revision_number?: string;

  gl_insurer_letter?: string; gl_commercial_general_liability?: boolean; gl_claims_made?: boolean; gl_occurrence?: boolean;
  gl_other_coverage_1?: string; gl_other_coverage_2?: string;
  gl_aggregate_applies_per?: 'policy' | 'project' | 'location' | 'other' | string; gl_aggregate_applies_other?: string;
  gl_additional_insured?: YN; gl_subrogation_waived?: YN; gl_policy_number?: string; gl_effective_date?: string; gl_expiration_date?: string;
  gl_each_occurrence?: string; gl_damage_to_rented_premises?: string; gl_medical_expense?: string; gl_personal_adv_injury?: string;
  gl_general_aggregate?: string; gl_products_completed_ops?: string; gl_other_limit_description?: string; gl_other_limit_amount?: string;

  auto_insurer_letter?: string; auto_any_auto?: boolean; auto_owned_autos_only?: boolean; auto_hired_autos_only?: boolean;
  auto_scheduled_autos?: boolean; auto_non_owned_autos_only?: boolean; auto_other_1?: string; auto_other_2?: string;
  auto_additional_insured?: YN; auto_subrogation_waived?: YN; auto_policy_number?: string; auto_effective_date?: string; auto_expiration_date?: string;
  auto_combined_single_limit?: string; auto_bodily_injury_per_person?: string; auto_bodily_injury_per_accident?: string;
  auto_property_damage?: string; auto_other_coverage_description?: string; auto_other_coverage_limit?: string;

  umbrella_insurer_letter?: string; umbrella_type?: 'umbrella' | 'excess' | string; umbrella_trigger?: 'occurrence' | 'claims-made' | string;
  umbrella_ded_or_retention?: 'deductible' | 'retention' | string; umbrella_ded_or_retention_amount?: string;
  umbrella_additional_insured?: YN; umbrella_subrogation_waived?: YN; umbrella_policy_number?: string;
  umbrella_effective_date?: string; umbrella_expiration_date?: string; umbrella_each_occurrence?: string; umbrella_aggregate?: string;
  umbrella_other_description?: string; umbrella_other_limit?: string;

  wc_insurer_letter?: string; wc_any_proprietor_excluded?: YN; wc_subrogation_waived?: YN; wc_policy_number?: string;
  wc_effective_date?: string; wc_expiration_date?: string; wc_per_statute?: boolean; wc_other?: string;
  wc_el_each_accident?: string; wc_el_disease_each_employee?: string; wc_el_disease_policy_limit?: string;

  other_insurer_letter?: string; other_policy_description?: string; other_additional_insured?: YN; other_subrogation_waived?: YN;
  other_policy_number?: string; other_effective_date?: string; other_expiration_date?: string;
  other_limits?: { description?: string; amount?: string }[];

  description_of_operations?: string;
  holder_name?: string; holder_address1?: string; holder_address2?: string; holder_city?: string; holder_state?: string; holder_zip?: string;
  authorized_representative?: string;
  summary?: string;
  missing?: string[];
}

/** Text boxes: data key -> PDF field (short name, after the "F[0].P1[0]." prefix, without "[0]"). */
const TEXT_FIELDS: Partial<Record<keyof Acord25Data, string>> = {
  issue_date: 'Form_CompletionDate_A',
  producer_name: 'Producer_FullName_A',
  producer_address1: 'Producer_MailingAddress_LineOne_A',
  producer_address2: 'Producer_MailingAddress_LineTwo_A',
  producer_city: 'Producer_MailingAddress_CityName_A',
  producer_state: 'Producer_MailingAddress_StateOrProvinceCode_A',
  producer_zip: 'Producer_MailingAddress_PostalCode_A',
  producer_contact_name: 'Producer_ContactPerson_FullName_A',
  producer_phone: 'Producer_ContactPerson_PhoneNumber_A',
  producer_fax: 'Producer_FaxNumber_A',
  producer_email: 'Producer_ContactPerson_EmailAddress_A',
  insured_name: 'NamedInsured_FullName_A',
  insured_address1: 'NamedInsured_MailingAddress_LineOne_A',
  insured_address2: 'NamedInsured_MailingAddress_LineTwo_A',
  insured_city: 'NamedInsured_MailingAddress_CityName_A',
  insured_state: 'NamedInsured_MailingAddress_StateOrProvinceCode_A',
  insured_zip: 'NamedInsured_MailingAddress_PostalCode_A',
  certificate_number: 'CertificateOfInsurance_CertificateNumberIdentifier_A',
  revision_number: 'CertificateOfInsurance_RevisionNumberIdentifier_A',

  gl_insurer_letter: 'GeneralLiability_InsurerLetterCode_A',
  gl_other_coverage_1: 'GeneralLiability_OtherCoverageDescription_A',
  gl_other_coverage_2: 'GeneralLiability_OtherCoverageDescription_B',
  gl_aggregate_applies_other: 'GeneralLiability_GeneralAggregate_LimitAppliesToCode_A',
  gl_additional_insured: 'CertificateOfInsurance_GeneralLiability_AdditionalInsuredCode_A',
  gl_subrogation_waived: 'Policy_GeneralLiability_SubrogationWaivedCode_A',
  gl_policy_number: 'Policy_GeneralLiability_PolicyNumberIdentifier_A',
  gl_effective_date: 'Policy_GeneralLiability_EffectiveDate_A',
  gl_expiration_date: 'Policy_GeneralLiability_ExpirationDate_A',
  gl_each_occurrence: 'GeneralLiability_EachOccurrence_LimitAmount_A',
  gl_damage_to_rented_premises: 'GeneralLiability_FireDamageRentedPremises_EachOccurrenceLimitAmount_A',
  gl_medical_expense: 'GeneralLiability_MedicalExpense_EachPersonLimitAmount_A',
  gl_personal_adv_injury: 'GeneralLiability_PersonalAndAdvertisingInjury_LimitAmount_A',
  gl_general_aggregate: 'GeneralLiability_GeneralAggregate_LimitAmount_A',
  gl_products_completed_ops: 'GeneralLiability_ProductsAndCompletedOperations_AggregateLimitAmount_A',
  gl_other_limit_description: 'GeneralLiability_OtherCoverageLimitDescription_A',
  gl_other_limit_amount: 'GeneralLiability_OtherCoverageLimitAmount_A',

  auto_insurer_letter: 'Vehicle_InsurerLetterCode_A',
  auto_other_1: 'Vehicle_OtherCoveredAutoDescription_A',
  auto_other_2: 'Vehicle_OtherCoveredAutoDescription_B',
  auto_additional_insured: 'CertificateOfInsurance_AutomobileLiability_AdditionalInsuredCode_A',
  auto_subrogation_waived: 'Policy_AutomobileLiability_SubrogationWaivedCode_A',
  auto_policy_number: 'Policy_AutomobileLiability_PolicyNumberIdentifier_A',
  auto_effective_date: 'Policy_AutomobileLiability_EffectiveDate_A',
  auto_expiration_date: 'Policy_AutomobileLiability_ExpirationDate_A',
  auto_combined_single_limit: 'Vehicle_CombinedSingleLimit_EachAccidentAmount_A',
  auto_bodily_injury_per_person: 'Vehicle_BodilyInjury_PerPersonLimitAmount_A',
  auto_bodily_injury_per_accident: 'Vehicle_BodilyInjury_PerAccidentLimitAmount_A',
  auto_property_damage: 'Vehicle_PropertyDamage_PerAccidentLimitAmount_A',
  auto_other_coverage_description: 'Vehicle_OtherCoverage_CoverageDescription_A',
  auto_other_coverage_limit: 'Vehicle_OtherCoverage_LimitAmount_A',

  umbrella_insurer_letter: 'ExcessUmbrella_InsurerLetterCode_A',
  umbrella_ded_or_retention_amount: 'ExcessUmbrella_Umbrella_DeductibleOrRetentionAmount_A',
  umbrella_additional_insured: 'CertificateOfInsurance_ExcessLiability_AdditionalInsuredCode_A',
  umbrella_subrogation_waived: 'Policy_ExcessLiability_SubrogationWaivedCode_A',
  umbrella_policy_number: 'Policy_ExcessLiability_PolicyNumberIdentifier_A',
  umbrella_effective_date: 'Policy_ExcessLiability_EffectiveDate_A',
  umbrella_expiration_date: 'Policy_ExcessLiability_ExpirationDate_A',
  umbrella_each_occurrence: 'ExcessUmbrella_Umbrella_EachOccurrenceAmount_A',
  umbrella_aggregate: 'ExcessUmbrella_Umbrella_AggregateAmount_A',
  umbrella_other_description: 'ExcessUmbrella_OtherCoverageDescription_A',
  umbrella_other_limit: 'ExcessUmbrella_OtherCoverageLimitAmount_A',

  wc_insurer_letter: 'WorkersCompensationEmployersLiability_InsurerLetterCode_A',
  wc_any_proprietor_excluded: 'WorkersCompensationEmployersLiability_AnyPersonsExcludedIndicator_A',
  wc_subrogation_waived: 'Policy_WorkersCompensation_SubrogationWaivedCode_A',
  wc_policy_number: 'Policy_WorkersCompensationAndEmployersLiability_PolicyNumberIdentifier_A',
  wc_effective_date: 'Policy_WorkersCompensationAndEmployersLiability_EffectiveDate_A',
  wc_expiration_date: 'Policy_WorkersCompensationAndEmployersLiability_ExpirationDate_A',
  wc_other: 'WorkersCompensationEmployersLiability_OtherCoverageDescription_A',
  wc_el_each_accident: 'WorkersCompensationEmployersLiability_EmployersLiability_EachAccidentLimitAmount_A',
  wc_el_disease_each_employee: 'WorkersCompensationEmployersLiability_EmployersLiability_DiseaseEachEmployeeLimitAmount_A',
  wc_el_disease_policy_limit: 'WorkersCompensationEmployersLiability_EmployersLiability_DiseasePolicyLimitAmount_A',

  other_insurer_letter: 'OtherPolicy_InsurerLetterCode_A',
  other_policy_description: 'OtherPolicy_OtherPolicyDescription_A',
  other_additional_insured: 'CertificateOfInsurance_OtherPolicy_AdditionalInsuredCode_A',
  other_subrogation_waived: 'OtherPolicy_SubrogationWaivedCode_A',
  other_policy_number: 'OtherPolicy_PolicyNumberIdentifier_A',
  other_effective_date: 'OtherPolicy_PolicyEffectiveDate_A',
  other_expiration_date: 'OtherPolicy_PolicyExpirationDate_A',

  description_of_operations: 'CertificateOfLiabilityInsurance_ACORDForm_RemarkText_A',
  holder_name: 'CertificateHolder_FullName_A',
  holder_address1: 'CertificateHolder_MailingAddress_LineOne_A',
  holder_address2: 'CertificateHolder_MailingAddress_LineTwo_A',
  holder_city: 'CertificateHolder_MailingAddress_CityName_A',
  holder_state: 'CertificateHolder_MailingAddress_StateOrProvinceCode_A',
  holder_zip: 'CertificateHolder_MailingAddress_PostalCode_A',
  authorized_representative: 'Producer_AuthorizedRepresentative_Signature_A',
};

/** Check boxes: data key (boolean) -> PDF field. */
const CHECK_FIELDS: Partial<Record<keyof Acord25Data, string>> = {
  gl_commercial_general_liability: 'GeneralLiability_CoverageIndicator_A',
  gl_claims_made: 'GeneralLiability_ClaimsMadeIndicator_A',
  gl_occurrence: 'GeneralLiability_OccurrenceIndicator_A',
  auto_any_auto: 'Vehicle_AnyAutoIndicator_A',
  auto_owned_autos_only: 'Vehicle_AllOwnedAutosIndicator_A',
  auto_hired_autos_only: 'Vehicle_HiredAutosIndicator_A',
  auto_scheduled_autos: 'Vehicle_ScheduledAutosIndicator_A',
  auto_non_owned_autos_only: 'Vehicle_NonOwnedAutosIndicator_A',
  wc_per_statute: 'WorkersCompensationEmployersLiability_WorkersCompensationStatutoryLimitIndicator_A',
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const shortName = (full: string) => full.replace(/^.*?P1\[0\]\./, '').replace(/\[\d+\]$/, '');

/** "Yes" / "X" / true -> "Y"; "No" -> "N" (the ADDL INSD / SUBR WVD boxes take a single letter). */
const yn = (v: unknown) => {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return '';
  if (['y', 'yes', 'x', 'true'].includes(t)) return 'Y';
  if (['n', 'no', 'false'].includes(t)) return 'N';
  return String(v).trim();
};
const YN_KEYS = new Set<keyof Acord25Data>([
  'gl_additional_insured', 'gl_subrogation_waived', 'auto_additional_insured', 'auto_subrogation_waived',
  'umbrella_additional_insured', 'umbrella_subrogation_waived', 'wc_any_proprietor_excluded', 'wc_subrogation_waived',
  'other_additional_insured', 'other_subrogation_waived',
]);

/**
 * Turns extracted data into { fullPdfFieldName: value } for the uploaded PDF.
 * Returns null when the PDF isn't the supported ACORD 25 edition.
 */
export function acord25ToFieldValues(data: Acord25Data, pdfFieldNames: string[]): Record<string, string> | null {
  const byShort = new Map(pdfFieldNames.map((n) => [shortName(n), n]));
  if (!byShort.has('Producer_FullName_A') || !byShort.has('CertificateHolder_FullName_A') || !byShort.has('Insurer_FullName_A')) return null;

  const values: Record<string, string> = {};
  const put = (short: string, value: unknown) => {
    const full = byShort.get(short);
    const text = value == null ? '' : String(value).trim();
    if (full && text) values[full] = text;
  };
  const check = (short: string, on: unknown) => { if (on === true) put(short, 'true'); };

  for (const [key, short] of Object.entries(TEXT_FIELDS)) {
    const v = data[key as keyof Acord25Data];
    put(short as string, YN_KEYS.has(key as keyof Acord25Data) ? yn(v) : v);
  }
  for (const [key, short] of Object.entries(CHECK_FIELDS)) check(short as string, data[key as keyof Acord25Data]);

  // Insurers A-F: use the letter the AI gave, else the list order.
  (data.insurers ?? []).slice(0, 6).forEach((ins, i) => {
    const letter = LETTERS.includes(String(ins.letter ?? '').toUpperCase()) ? String(ins.letter).toUpperCase() : LETTERS[i];
    put(`Insurer_FullName_${letter}`, ins.name);
    put(`Insurer_NAICCode_${letter}`, ins.naic);
  });

  // Choices that are a set of boxes.
  if (data.gl_other_coverage_1) check('GeneralLiability_OtherCoverageIndicator_A', true);
  if (data.gl_other_coverage_2) check('GeneralLiability_OtherCoverageIndicator_B', true);
  const agg = String(data.gl_aggregate_applies_per ?? '').toLowerCase();
  if (agg.includes('policy')) check('GeneralLiability_GeneralAggregate_LimitAppliesPerPolicyIndicator_A', true);
  else if (agg.includes('project')) check('GeneralLiability_GeneralAggregate_LimitAppliesPerProjectIndicator_A', true);
  else if (agg.includes('loc')) check('GeneralLiability_GeneralAggregate_LimitAppliesPerLocationIndicator_A', true);
  else if (agg.includes('other') || data.gl_aggregate_applies_other) check('GeneralLiability_GeneralAggregate_LimitAppliesToOtherIndicator_A', true);
  if (data.auto_other_1) check('Vehicle_OtherCoveredAutoIndicator_A', true);
  if (data.auto_other_2) check('Vehicle_OtherCoveredAutoIndicator_B', true);
  const umb = String(data.umbrella_type ?? '').toLowerCase();
  if (umb.includes('umbrella')) check('Policy_PolicyType_UmbrellaIndicator_A', true);
  if (umb.includes('excess')) check('Policy_PolicyType_ExcessIndicator_A', true);
  const trig = String(data.umbrella_trigger ?? '').toLowerCase();
  if (trig.includes('occur')) check('ExcessUmbrella_OccurrenceIndicator_A', true);
  if (trig.includes('claim')) check('ExcessUmbrella_ClaimsMadeIndicator_A', true);
  const dr = String(data.umbrella_ded_or_retention ?? '').toLowerCase();
  if (dr.includes('ded')) check('ExcessUmbrella_DeductibleIndicator_A', true);
  if (dr.includes('ret')) check('ExcessUmbrella_RetentionIndicator_A', true);
  if (data.wc_other) check('WorkersCompensationEmployersLiability_OtherCoverageIndicator_A', true);
  (data.other_limits ?? []).slice(0, 3).forEach((l, i) => {
    put(`OtherPolicy_CoverageCode_${LETTERS[i]}`, l.description);
    put(`OtherPolicy_CoverageLimitAmount_${LETTERS[i]}`, l.amount);
  });
  return values;
}
