// Answer-key rules for the five ACORD scenarios (src/data/modules.ts).
// Each rule finds ONE field on the uploaded fillable PDF — by its AcroForm name (n) or, for PDFs with
// generic names like "Text31", by the ACORD tooltip text (tip, nth = 1st/2nd/... match top-to-bottom) —
// and stores the expected answer the server-side grader uses.
//
// Regenerate the SQL after editing:   node supabase/answer-keys/build.mjs
//
// match:  exact | contains | any-of | keywords | present        (values separated by | are alternatives)
// miss:   penalize (default) | optional (blank is not scored)   | expect_blank

const money = (n) => `${n}|${n}.00`;
const phone = (last7) => `${last7}|${last7.replace('-', '.')}|${last7.replace('-', '')}|${last7.replace('-', ' ')}`;
const state = (code, name) => `${code}|${name}`;
const yes = { kind: 'checkbox', v: 'true', match: 'exact' };

/** @type {Record<string, Array<Record<string, any>>>} */
export const RULES = {
  // ------------------------------------------------------------------ ACORD 125 — Riverstone Construction
  '125': [
    { key: 'ni_name', label: 'Named Insured — legal name', n: 'NamedInsured_FullName_A', v: 'Riverstone Construction Co., LLC', match: 'contains', pts: 6, req: true },
    { key: 'ni_addr1', label: 'Mailing address — street', n: 'NamedInsured_MailingAddress_LineOne_A', v: '4820 Industrial Parkway|4820 Industrial Pkwy', match: 'contains', pts: 4, req: true },
    { key: 'ni_addr2', label: 'Mailing address — suite', n: 'NamedInsured_MailingAddress_LineTwo_A', v: '220', match: 'contains', pts: 2, miss: 'optional', hint: 'Suite 220 may go on line one or line two.' },
    { key: 'ni_city', label: 'Mailing address — city', n: 'NamedInsured_MailingAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 3, req: true },
    { key: 'ni_state', label: 'Mailing address — state', n: 'NamedInsured_MailingAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 2, req: true },
    { key: 'ni_zip', label: 'Mailing address — ZIP', n: 'NamedInsured_MailingAddress_PostalCode_A', v: '95841', match: 'contains', pts: 3, req: true },
    { key: 'ni_phone', label: 'Named insured phone', n: 'NamedInsured_Primary_PhoneNumber_A', v: phone('555-0142'), match: 'contains', pts: 2 },
    { key: 'ni_llc', label: 'Legal entity — LLC', n: 'NamedInsured_LegalEntity_LimitedLiabilityCorporationIndicator_A', ...yes, pts: 4, req: true, hint: 'The legal name ends in "LLC".' },
    { key: 'sec_gl', label: 'Section attached — General Liability', n: '(Policy_SectionAttached_GeneralLiabilityIndicator|Policy_LineOfBusiness_CommercialGeneralLiability)_A', ...yes, pts: 2 },
    { key: 'sec_auto', label: 'Section attached — Business Auto', n: '(Policy_SectionAttached|Policy_LineOfBusiness)_BusinessAutoIndicator_A', ...yes, pts: 2 },
    { key: 'sec_prop', label: 'Section attached — Property', n: '(Policy_SectionAttached_PropertyIndicator|Policy_LineOfBusiness_CommercialProperty)_A', ...yes, pts: 2 },
    { key: 'contact_name', label: 'Contact — name', n: 'NamedInsured_Contact_FullName_A', v: 'Marcus Chen', match: 'contains', pts: 3, req: true },
    { key: 'contact_phone', label: 'Contact — phone', n: 'NamedInsured_Contact_PrimaryPhoneNumber_A', v: phone('555-0142'), match: 'contains', pts: 2 },
    { key: 'contact_email', label: 'Contact — e-mail', n: 'NamedInsured_Contact_PrimaryEmailAddress_A', v: 'mchen@riverstoneconstruction.com', match: 'exact', pts: 3, hint: 'Copy e-mail addresses character for character.' },
    { key: 'loc_addr1', label: 'Premises — street', n: 'CommercialStructure_PhysicalAddress_LineOne_A', v: '4820 Industrial Parkway|4820 Industrial Pkwy', match: 'contains', pts: 3 },
    { key: 'loc_city', label: 'Premises — city', n: 'CommercialStructure_PhysicalAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 2 },
    { key: 'loc_state', label: 'Premises — state', n: 'CommercialStructure_PhysicalAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 1 },
    { key: 'loc_zip', label: 'Premises — ZIP', n: 'CommercialStructure_PhysicalAddress_PostalCode_A', v: '95841', match: 'contains', pts: 2 },
    { key: 'employees', label: 'Full-time employees', n: 'BusinessInformation_FullTimeEmployeeCount_A', v: '35', match: 'exact', pts: 3 },
    { key: 'revenue', label: 'Annual revenue', n: 'CommercialStructure_AnnualRevenueAmount_A', v: money(4200000), match: 'any-of', pts: 4, hint: '"~$4.2M" is entered as 4,200,000.' },
    { key: 'biz_contractor', label: 'Nature of business — Contractor', n: 'BusinessInformation_BusinessType_ContractorIndicator_A', ...yes, pts: 3 },
    { key: 'ops_desc', label: 'Description of operations', n: 'CommercialPolicy_OperationsDescription_A', v: 'contractor', match: 'contains', pts: 4 },
    { key: 'ai_type', label: 'Additional interest — Additional Insured', n: 'AdditionalInterest_Interest_AdditionalInsuredIndicator_A', ...yes, pts: 3 },
    { key: 'ai_name', label: 'Additional insured — name', n: 'AdditionalInterest_FullName_A', v: 'Westfield Development', match: 'contains', pts: 4, req: true },
    { key: 'ai_addr1', label: 'Additional insured — street', n: 'AdditionalInterest_MailingAddress_LineOne_A', v: '1100 Capital Mall', match: 'contains', pts: 3 },
    { key: 'ai_city', label: 'Additional insured — city', n: 'AdditionalInterest_MailingAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 2 },
    { key: 'ai_state', label: 'Additional insured — state', n: 'AdditionalInterest_MailingAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 1 },
    { key: 'ai_zip', label: 'Additional insured — ZIP', n: 'AdditionalInterest_MailingAddress_PostalCode_A', v: '95814', match: 'contains', pts: 2, hint: 'The additional insured ZIP (95814) differs from the insured ZIP (95841).' },
    { key: 'ai_cert', label: 'Certificate required', n: 'AdditionalInterest_CertificateRequiredIndicator_A', ...yes, pts: 2 },
    { key: 'prior_carrier', label: 'Prior carrier (GL)', n: 'PriorCoverage_(GeneralLiability_)?InsurerFullName_A', v: 'Travelers', match: 'contains', pts: 3 },
    { key: 'prior_exp', label: 'Prior policy expiration (GL)', n: 'PriorCoverage_(GeneralLiability_)?ExpirationDate_A', v: '01/15/2027', match: 'exact', pts: 3, hint: 'Dates use MM/DD/YYYY.' },
  ],

  // ------------------------------------------------------------------ ACORD 126 — Harvest Kitchen & Market
  // This edition uses generic field names (Text1, Check1 ...) so fields are found by their ACORD tooltip.
  '126': [
    { key: 'ni_name', label: 'Named Insured', n: 'NamedInsured_FullName_A', tip: 'named insured\\(s\\) as it', v: 'Harvest Kitchen', match: 'contains', pts: 5, req: true },
    { key: 'occurrence', label: 'Occurrence basis', tip: 'occurrence basis applies', ...yes, pts: 3 },
    { key: 'gen_agg', label: 'General aggregate limit', tip: 'general aggregate limit amount', v: money(2000000), match: 'any-of', pts: 5, req: true },
    { key: 'products', label: 'Products/completed ops aggregate', tip: 'products and completed operations aggregate limit amount', v: money(1000000), match: 'any-of', pts: 5, req: true },
    { key: 'each_occ', label: 'Each occurrence limit', tip: 'liability, each occurrence limit amount', v: money(1000000), match: 'any-of', pts: 5, req: true },
    { key: 'deductible', label: 'Deductible amount ($5,000)', tip: 'deductible applicable to the Property Damage', v: money(5000), match: 'any-of', pts: 3, hint: 'The requested $5,000 deductible.' },
    { key: 'haz1_class', label: 'Hazard 1 — classification', tip: 'classification the applicant', nth: 1, v: 'restaurant', match: 'contains', pts: 4 },
    { key: 'haz1_code', label: 'Hazard 1 — class code (optional)', tip: 'class code that corresponds', nth: 1, v: '', match: 'present', pts: 1, miss: 'optional', hint: 'The class code is optional (per the training video).' },
    { key: 'haz1_basis', label: 'Hazard 1 — premium basis', tip: 'rating basis of the exposure', nth: 1, v: 'S|Sales|Gross Sales', match: 'any-of', pts: 3, hint: 'Restaurants are rated on gross sales (S).' },
    { key: 'haz2_class', label: 'Hazard 2 — classification', tip: 'classification the applicant', nth: 2, v: 'catering', match: 'contains', pts: 4 },
    { key: 'haz2_code', label: 'Hazard 2 — class code (optional)', tip: 'class code that corresponds', nth: 2, v: '', match: 'present', pts: 1, miss: 'optional' },
    { key: 'haz2_basis', label: 'Hazard 2 — premium basis', tip: 'rating basis of the exposure', nth: 2, v: 'S|Sales|Gross Sales', match: 'any-of', pts: 2 },
    { key: 'haz2_exposure', label: 'Hazard 2 — catering exposure', tip: 'amount of the exposure used for this class code', nth: 2, v: money(45000), match: 'any-of', pts: 4, hint: 'Catering revenue was ~$45K.' },
  ],

  // ------------------------------------------------------------------ ACORD 127 — GreenLine Logistics
  '127': [
    { key: 'ni_name', label: 'Named Insured', n: 'NamedInsured_FullName_A', v: 'GreenLine Logistics', match: 'contains', pts: 5, req: true },
    ...[
      ['David', 'Okoro', '04/12/1985', 'O4589123'],
      ['Maria', 'Santos', '09/23/1988', 'S2278901'],
      ['Tyrone', 'Johnson', '02/15/1990', 'J1190345'],
      ['Ahmed', 'Hassan', '11/30/1982', 'H8890234'],
      ['Lisa', 'Chen', '06/18/1995', 'C5567890'],
    ].flatMap(([first, last, dob, dl], i) => {
      const L = 'ABCDE'[i];
      const d = `Driver ${i + 1}`;
      return [
        { key: `drv${i + 1}_first`, label: `${d} — first name`, n: `Driver_GivenName_${L}`, v: first, match: 'exact', pts: 2, req: i === 0 },
        { key: `drv${i + 1}_last`, label: `${d} — last name`, n: `Driver_Surname_${L}`, v: last, match: 'exact', pts: 2, req: i === 0 },
        { key: `drv${i + 1}_dob`, label: `${d} — date of birth`, n: `Driver_BirthDate_${L}`, v: dob, match: 'exact', pts: 2 },
        { key: `drv${i + 1}_dl`, label: `${d} — license #`, n: `Driver_LicenseNumberIdentifier_${L}`, v: dl, match: 'exact', pts: 3, hint: 'License numbers start with a letter (O, not zero).' },
        { key: `drv${i + 1}_state`, label: `${d} — license state`, n: `Driver_LicensedStateOrProvinceCode_${L}`, v: state('TX', 'Texas'), match: 'any-of', pts: 1 },
      ];
    }),
    ...[
      ['2022', 'Freightliner', 'Cascadia', '1FUJGHDV0LLAB1234', 145000],
      ['2021', 'Peterbilt', '579', '1XPBDP9X1MD7823456', 138000],
      ['2023', 'Kenworth', 'T680', '2NKHHM7X4PM8901234', 150000],
      ['2020', 'Volvo', 'VNL', '4V4NC9EH0LN5678901', 125000],
    ].flatMap(([year, make, model, vin, cost], i) => {
      const L = 'ABCD'[i];
      const v = `Vehicle ${i + 1}`;
      return [
        { key: `veh${i + 1}_year`, label: `${v} — year`, n: `Vehicle_ModelYear_${L}`, v: year, match: 'exact', pts: 2 },
        { key: `veh${i + 1}_make`, label: `${v} — make`, n: `Vehicle_ManufacturersName_${L}`, v: make, match: 'contains', pts: 2 },
        { key: `veh${i + 1}_model`, label: `${v} — model`, n: `Vehicle_ModelName_${L}`, v: model, match: 'contains', pts: 2 },
        { key: `veh${i + 1}_vin`, label: `${v} — VIN`, n: `Vehicle_VINIdentifier_${L}`, v: vin, match: 'exact', pts: 4, req: i === 0, hint: 'VINs must match exactly — check every character.' },
        { key: `veh${i + 1}_cost`, label: `${v} — cost new`, n: `Vehicle_CostNewAmount_${L}`, v: money(cost), match: 'any-of', pts: 2 },
        { key: `veh${i + 1}_zip`, label: `${v} — garaging ZIP`, n: `Vehicle_PhysicalAddress_PostalCode_${L}`, v: '75207', match: 'contains', pts: 2 },
        { key: `veh${i + 1}_radius`, label: `${v} — radius`, n: `Vehicle_RadiusOfUse_${L}`, v: '500', match: 'contains', pts: 1 },
        { key: `veh${i + 1}_liab`, label: `${v} — liability coverage`, n: `Vehicle_Coverage_LiabilityIndicator_${L}`, ...yes, pts: 1 },
        { key: `veh${i + 1}_comp`, label: `${v} — comprehensive`, n: `Vehicle_Coverage_ComprehensiveIndicator_${L}`, ...yes, pts: 1 },
        { key: `veh${i + 1}_coll`, label: `${v} — collision`, n: `Vehicle_Coverage_CollisionIndicator_${L}`, ...yes, pts: 1 },
        { key: `veh${i + 1}_comp_ded`, label: `${v} — comprehensive deductible`, n: `Vehicle_Coverage_ComprehensiveOrSpecifiedCauseOfLossDeductibleAmount_${L}`, v: money(1000), match: 'any-of', pts: 1 },
        { key: `veh${i + 1}_coll_ded`, label: `${v} — collision deductible`, n: `Vehicle_Collision_DeductibleAmount_${L}`, v: money(1000), match: 'any-of', pts: 1 },
      ];
    }),
    { key: 'veh_schedule', label: 'Additional vehicle schedule attached', n: 'CommercialVehicleLineOfBusiness_Attachment_VehicleScheduleIndicator_A', ...yes, pts: 3, hint: 'The fleet has 8 vehicles but the form has room for 4, so the extra vehicles go on an attached schedule.' },
  ],

  // ------------------------------------------------------------------ ACORD 130 — Summit Roofing & Solar
  // Name-based rules for the standard fillable ACORD 130. Verify the match count after uploading.
  '130': [
    { key: 'ni_name', label: 'Applicant name', n: 'NamedInsured_FullName_A', v: 'Summit Roofing', match: 'contains', pts: 5, req: true },
    { key: 'ni_addr1', label: 'Mailing address — street', n: 'NamedInsured_MailingAddress_LineOne_A', v: '3200 Commerce Center', match: 'contains', pts: 3 },
    { key: 'ni_city', label: 'Mailing address — city', n: 'NamedInsured_MailingAddress_CityName_A', v: 'Denver', match: 'exact', pts: 2 },
    { key: 'ni_state', label: 'Mailing address — state', n: 'NamedInsured_MailingAddress_StateOrProvinceCode_A', v: state('CO', 'Colorado'), match: 'any-of', pts: 2 },
    { key: 'ni_zip', label: 'Mailing address — ZIP', n: 'NamedInsured_MailingAddress_PostalCode_A', v: '80205', match: 'contains', pts: 2 },
    { key: 'ni_fein', label: 'FEIN', n: 'NamedInsured_TaxIdentifier_A', tip: 'federal employer', v: '84-3920174|843920174', match: 'any-of', pts: 5, req: true },
    { key: 'ni_llc', label: 'Legal entity — LLC', n: 'NamedInsured_LegalEntity_LimitedLiabilityCorporationIndicator_A', ...yes, pts: 3 },
    { key: 'contact_name', label: 'Contact — name', n: 'NamedInsured_Contact_FullName_A', v: 'Rachel Kim', match: 'contains', pts: 3 },
    { key: 'contact_phone', label: 'Contact — phone', n: 'NamedInsured_Contact_PrimaryPhoneNumber_A', v: phone('555-0123'), match: 'contains', pts: 2 },
    ...[['5551', 850000, 18], ['5190', 420000, 8], ['8810', 280000, 4], ['7380', 190000, 5]].flatMap(([code, payroll, emps], i) => [
      { key: `cc${i + 1}_code`, label: `Class ${i + 1} — class code`, tip: 'class(ification)? code', nth: i + 1, v: code, match: 'contains', pts: 4, req: i === 0 },
      { key: `cc${i + 1}_payroll`, label: `Class ${i + 1} — annual payroll`, tip: 'remuneration|payroll', nth: i + 1, v: money(payroll), match: 'any-of', pts: 3 },
      { key: `cc${i + 1}_emps`, label: `Class ${i + 1} — # employees`, tip: 'number of (full time )?employees', nth: i + 1, v: String(emps), match: 'exact', pts: 2 },
    ]),
    { key: 'el_each', label: "Employer's liability — each accident", tip: 'each accident', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'el_policy', label: "Employer's liability — disease policy limit", tip: 'disease.{0,40}policy limit', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'el_employee', label: "Employer's liability — disease each employee", tip: 'disease.{0,40}each employee', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'other_states', label: 'Part Three — other states', tip: 'other states', v: 'UT WY NM AZ', match: 'keywords', pts: 3, hint: 'All four other states must be listed: UT, WY, NM, AZ.' },
    { key: 'officer1_name', label: 'Owner/officer 1 — name', tip: 'name of the (owner|officer|individual)', nth: 1, v: 'Tyler Brennan', match: 'contains', pts: 3 },
    { key: 'officer2_name', label: 'Owner/officer 2 — name', tip: 'name of the (owner|officer|individual)', nth: 2, v: 'Nicole Park', match: 'contains', pts: 3 },
    { key: 'prior_carrier', label: 'Prior carrier', n: 'PriorCoverage_InsurerFullName_A', tip: 'name of the previous insurer', v: 'AmTrust', match: 'contains', pts: 2 },
  ],

  // ------------------------------------------------------------------ ACORD 140 — BlueRidge Manufacturing
  '140': [
    { key: 'ni_name', label: 'Named Insured', n: 'NamedInsured_FullName_A', v: 'BlueRidge Manufacturing', match: 'contains', pts: 5, req: true },
    { key: 'loc_addr', label: 'Premises — street address', n: 'CommercialStructure_PhysicalAddress_LineOne_A', v: '1500 Industrial Park', match: 'contains', pts: 4, req: true },
    ...[
      ['Building', 'Building|Bldg|B', 2850000],
      ['Business Personal Property', 'BPP|Business Personal Property|Contents|Personal Property', 1650000],
    ].flatMap(([name, subject, limit], i) => {
      // As taught in the ACORD 140 video: subject of insurance is Building and/or BPP;
      // Business Income is a checkbox in the additional-information box (not a third row).
      const L = 'AB'[i];
      const row = `Row ${L} (${name})`;
      return [
        { key: `sub${i + 1}_subject`, label: `${row} — subject of insurance`, n: `CommercialProperty_Premises_SubjectOfInsuranceCode_${L}`, v: subject, match: 'any-of', pts: 3, hint: 'List Building first, then Business Personal Property (BPP).' },
        { key: `sub${i + 1}_limit`, label: `${row} — amount`, n: `CommercialProperty_Premises_LimitAmount_${L}`, v: money(limit), match: 'any-of', pts: 5, req: true },
        { key: `sub${i + 1}_col`, label: `${row} — cause of loss`, n: `CommercialProperty_Premises_CauseOfLossCode_${L}`, v: 'special', match: 'contains', pts: 3 },
        { key: `sub${i + 1}_coins`, label: `${row} — coinsurance %`, n: `CommercialProperty_Premises_CoinsurancePercent_${L}`, v: '80|80%', match: 'any-of', pts: 2 },
        { key: `sub${i + 1}_val`, label: `${row} — valuation`, n: `CommercialProperty_Premises_ValuationCode_${L}`, v: 'RC|RCV|Replacement Cost|Replacement Cost Value|Replacement', match: 'any-of', pts: 3 },
        { key: `sub${i + 1}_ded`, label: `${row} — deductible`, n: `CommercialProperty_Premises_DeductibleAmount_${L}`, v: money(2500), match: 'any-of', pts: 2 },
      ];
    }),
    { key: 'bi_box', label: 'Business Income box checked', n: 'CommercialProperty_Attachment_BusinessIncomeExtraExpenseIndicator_A', ...yes, pts: 4, hint: 'The scenario requests business income — always check the Business Income box.' },
    { key: 'construction', label: 'Construction type', n: 'Construction_ConstructionCode_A', v: 'Joisted Masonry|JM|2|Class 2', match: 'any-of', pts: 5, req: true },
    { key: 'year_built', label: 'Year built', n: 'CommercialStructure_BuiltYear_A', v: '1998', match: 'exact', pts: 3 },
    { key: 'sqft', label: 'Total area (sq ft)', n: 'Construction_BuildingArea_A', v: '28000', match: 'contains', pts: 3 },
    { key: 'roof', label: 'Roof material', n: 'Construction_RoofMaterialCode_A', v: 'built', match: 'contains', pts: 2 },
    { key: 'pc', label: 'Protection class', n: 'BuildingFireProtection_ProtectionClassCode_A', v: '4', match: 'exact', pts: 4 },
    { key: 'hydrant', label: 'Distance to hydrant (ft)', n: 'BuildingFireProtection_HydrantDistanceFeetCount_A', v: '250', match: 'contains', pts: 2 },
    { key: 'station', label: 'Distance to fire station (mi)', n: 'BuildingFireProtection_FireStationDistanceMileCount_A', v: '1.2', match: 'contains', pts: 2 },
    { key: 'sprinkler', label: 'Sprinkler coverage %', n: 'BuildingFireProtection_Alarm_SprinklerPercent_A', v: '100|100%', match: 'any-of', pts: 3, hint: '"Fully sprinklered throughout" = 100%.' },
    { key: 'wiring', label: 'Wiring update', n: 'BuildingImprovement_WiringIndicator_A', ...yes, pts: 1 },
    { key: 'wiring_yr', label: 'Wiring update year', n: 'BuildingImprovement_WiringYear_A', v: '2020', match: 'exact', pts: 2 },
    { key: 'roofing', label: 'Roof update', n: 'BuildingImprovement_RoofingIndicator_A', ...yes, pts: 1 },
    { key: 'roofing_yr', label: 'Roof update year', n: 'BuildingImprovement_RoofingYear_A', v: '2021', match: 'exact', pts: 2 },
  ],
};
