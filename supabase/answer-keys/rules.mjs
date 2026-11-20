// Answer-key rules for the ACORD scenarios (src/data/modules.ts).
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
  // Built for the fillable "Acord-130-2019.pdf" (plain-English field names such as "APPLICANT NAME",
  // "CLASS CODERow1_2"); the standard ACORD names are listed as alternatives where they exist.
  '130': [
    { key: 'ni_name', label: 'Applicant name', n: '(APPLICANT NAME|NamedInsured_FullName_A)', v: 'Summit Roofing', match: 'contains', pts: 5, req: true },
    { key: 'ni_phone', label: 'Applicant office phone', n: 'OFFICE PHONE', v: phone('555-0123'), match: 'contains', pts: 2 },
    { key: 'ni_mailing', label: 'Mailing address', n: 'MAILING ADDRESS including ZIP  4 or Canadian Postal Code', v: '3200 Commerce Center Denver 80205', match: 'keywords', pts: 4, hint: '3200 Commerce Center Drive, Denver, CO 80205 (ZIP+4 is not needed for a quote).' },
    { key: 'ni_entity', label: 'Legal entity — LLC', n: 'Group1', kind: 'radio', v: 'LLC', match: 'exact', pts: 3, hint: 'The applicant name ends in "LLC".' },
    { key: 'ni_fein', label: 'Federal Employer ID (FEIN)', n: '(FEDERAL EMPLOYER ID NUMBER|NamedInsured_TaxIdentifier_A)', v: '84-3920174|843920174', match: 'any-of', pts: 6, req: true, hint: 'The video stresses the FEIN is what you need to get a quote.' },
    { key: 'status_quote', label: 'Status of submission — Quote', n: 'STATUS OF SUBMISSION', kind: 'radio', v: 'QUOTE', match: 'exact', pts: 2 },
    { key: 'loc1', label: 'Location 1 address', n: 'STREET CITY COUNTY STATE ZIP CODERow1', v: '3200 Commerce Center Denver', match: 'keywords', pts: 3 },
    { key: 'eff_date', label: 'Proposed effective date', n: 'PROPOSED EFF DATE', v: '', match: 'present', pts: 2, hint: 'The proposed effective date is required.' },
    { key: 'part1_states', label: 'Part 1 — WC states', n: 'PART 1  WORKERS COMPENSATION States', v: 'CO|Colorado', match: 'contains', pts: 3 },
    { key: 'el_each', label: "Part 2 — EL each accident", n: 'EACH ACCIDENT', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'el_policy', label: "Part 2 — EL disease-policy limit", n: 'DISEASE-POLICY LIMIT', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'el_employee', label: "Part 2 — EL disease-each employee", n: 'DISEASE-EACH EMPLOYEE', v: money(1000000), match: 'any-of', pts: 3 },
    { key: 'part3_states', label: 'Part 3 — other states', n: 'PART 3 - OTHER STATES INS', v: 'UT WY NM AZ', match: 'keywords', pts: 4, hint: 'List all four other states: UT, WY, NM, AZ.' },
    ...[
      ['Tyler Brennan', 'President', '60', 120000],
      ['Nicole Park', 'VP|Vice President', '30', 95000],
    ].flatMap(([name, title, pct, pay], i) => {
      const R = i + 1;
      const who = `Owner/officer ${R}`;
      return [
        { key: `off${R}_name`, label: `${who} — name`, n: `NAMERow${R}`, v: name, match: 'contains', pts: 3, req: R === 1 },
        { key: `off${R}_title`, label: `${who} — title`, n: `TITLE RELATIONSHIPRow${R}`, v: title, match: 'contains', pts: 1 },
        { key: `off${R}_pct`, label: `${who} — ownership %`, n: `OWNER SHIP Row${R}`, v: `${pct}|${pct}%`, match: 'any-of', pts: 2 },
        { key: `off${R}_inc`, label: `${who} — included`, n: `INCEXCRow${R}`, v: 'INC|Included|Include|I', match: 'any-of', pts: 3, hint: 'Both active owners are included in coverage.' },
        { key: `off${R}_class`, label: `${who} — class code`, n: `CLASS CODERow${R}`, v: '', match: 'present', pts: 1, hint: 'Included individuals need a class code and payroll.' },
        { key: `off${R}_pay`, label: `${who} — payroll`, n: `REMUNERATIONPAYROLLRow${R}`, v: money(pay), match: 'any-of', pts: 2 },
      ];
    }),
    { key: 'rating_state', label: 'State rating worksheet — state', n: 'STATE', v: 'CO|Colorado', match: 'any-of', pts: 1 },
    ...[
      ['5551', 'roof', 18, 850000],
      ['5190', 'solar|electric', 8, 420000],
      ['8810', 'clerical|office', 4, 280000],
      ['7380', 'sales|outside', 5, 190000],
    ].flatMap(([code, desc, emps, payroll], i) => {
      const R = i + 1;
      const c = `Class ${R} (${code})`;
      return [
        { key: `cc${R}_code`, label: `${c} — class code`, n: `CLASS CODERow${R}_2`, v: code, match: 'contains', pts: 4, req: R === 1, hint: 'Each type of work gets its own class code — confirm codes with NCCI.' },
        { key: `cc${R}_desc`, label: `${c} — description`, n: `CATEGORIES DUTIES CLASSIFICATIONSRow${R}`, v: desc, match: 'contains', pts: 1 },
        { key: `cc${R}_ft`, label: `${c} — full-time employees`, n: `FULE TIME_${R}`, v: String(emps), match: 'exact', pts: 2 },
        { key: `cc${R}_payroll`, label: `${c} — annual payroll`, n: `ESTIMATED ANNUAL REMUNERATION PAYROLLRow${R}`, v: money(payroll), match: 'any-of', pts: 3 },
      ];
    }),
    { key: 'prior_carrier', label: 'Prior carrier', n: '(CO|PriorCoverage_InsurerFullName_A)', v: 'AmTrust', match: 'contains', pts: 2 },
    { key: 'ops_desc', label: 'Description of operations', tip: '^GIVE COMMENTS AND DESCRIPTIONS OF BUSINESS', v: 'roofing solar', match: 'keywords', pts: 3, hint: 'Describe both operations: roofing and rooftop solar installation.' },
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

  // ------------------------------------------------------------------ ACORD 27 — BlueRidge Manufacturing / First Carolina Bank
  // Fields of the fillable "Evidence Of Property Ins.pdf" (ACORD 27 2006/07), which uses generic names (LOC, COVERAGE1, ...);
  // each rule notes the printed label. The coverage grid repeats one name per row, so `nth` picks the row (top to bottom).
  '27': [
    { key: 'issue_date', label: 'Issue date (top right)', n: 'Date2', v: '', match: 'present', pts: 2, hint: 'The issue date is the date the agency creates the document (MM/DD/YYYY).' },
    { key: 'agency', sample: 'Pinnacle Surety & Insurance Agency\n48 Patton Avenue, Suite 300\nAsheville, NC 28801', label: 'Agency (producer) name and address', n: 'COVERAGE1', v: 'Pinnacle Surety', match: 'contains', pts: 3, req: true },
    { key: 'agency_phone', sample: '(828) 555-0190', label: 'Agency phone', n: 'Phone', v: phone('555-0190'), match: 'contains', pts: 2 },
    { key: 'agency_email', label: 'Agency e-mail', n: 'LOC', v: 'service@pinnaclesurety.com', match: 'exact', pts: 1, hint: 'Copy e-mail addresses character for character.' },
    { key: 'company', sample: 'Keystone Mutual Insurance Company', label: 'Company (insurer)', n: 'Company', v: 'Keystone Mutual', match: 'contains', pts: 4, req: true },
    { key: 'insured', sample: 'BlueRidge Manufacturing, Inc.\n1500 Industrial Park Lane\nAsheville, NC 28806', label: 'Insured name and address', n: 'COVERAGE12', v: 'BlueRidge Manufacturing', match: 'contains', pts: 5, req: true },
    { key: 'loan_top', label: 'Loan number (top section)', n: 'LOC4', v: '88-301557|88301557', match: 'any-of', pts: 3 },
    { key: 'policy_no', label: 'Policy number', n: 'LOC5', v: 'CPP-4471209|CPP4471209', match: 'any-of', pts: 6, req: true, hint: 'Copy the policy number exactly, including any prefix.' },
    { key: 'eff', label: 'Effective date', n: 'Date', v: '09/01/2026', match: 'exact', pts: 3, req: true, hint: 'Dates use MM/DD/YYYY.' },
    { key: 'exp', label: 'Expiration date', n: 'Date1', v: '09/01/2027', match: 'exact', pts: 3, req: true, hint: 'Dates use MM/DD/YYYY.' },
    { key: 'location', sample: '1500 Industrial Park Lane, Asheville, NC 28806. One-story, 28,000 sq ft joisted masonry manufacturing building.', label: 'Property location / description', n: 'COVERAGE11', v: '1500 Industrial Park manufacturing', match: 'keywords', pts: 4, req: true, hint: 'Give the street address and a brief description of the building.' },
    { key: 'cov1_desc', sample: 'Building, Special Form causes of loss, replacement cost', label: 'Coverage row 1 — Building, special form', n: 'covperils1', nth: 1, v: 'building special', match: 'keywords', pts: 3, hint: 'Describe the coverage and the causes of loss (special).' },
    { key: 'cov1_amt', sample: '$2,850,000', label: 'Coverage row 1 — amount of insurance', n: 'amtinsur', nth: 1, v: money(2850000), match: 'any-of', pts: 3 },
    { key: 'cov1_ded', sample: '$2,500', label: 'Coverage row 1 — deductible', n: 'deduct', nth: 1, v: money(2500), match: 'any-of', pts: 2 },
    { key: 'cov2_desc', sample: 'Business Personal Property, Special Form, replacement cost', label: 'Coverage row 2 — Business Personal Property', n: 'covperils1', nth: 2, v: 'personal property|BPP|contents', match: 'contains', pts: 3 },
    { key: 'cov2_amt', sample: '$1,650,000', label: 'Coverage row 2 — amount of insurance', n: 'amtinsur', nth: 2, v: money(1650000), match: 'any-of', pts: 3 },
    { key: 'cov2_ded', sample: '$2,500', label: 'Coverage row 2 — deductible', n: 'deduct', nth: 2, v: money(2500), match: 'any-of', pts: 2 },
    { key: 'cov3_desc', sample: 'Business Income, Special Form, 12 months', label: 'Coverage row 3 — Business Income', n: 'covperils1', nth: 3, v: 'business income', match: 'contains', pts: 2 },
    { key: 'cov3_amt', sample: 'Actual Loss Sustained', label: 'Coverage row 3 — amount (actual loss sustained)', n: 'amtinsur', nth: 3, v: 'actual loss|ALS|12 months', match: 'contains', pts: 2 },
    { key: 'cancel_days', label: 'Cancellation — days written notice', n: 'NOAUTOS', v: '10', match: 'exact', pts: 2 },
    { key: 'ai_name', sample: 'First Carolina Bank, ISAOA/ATIMA\nPO Box 7740\nCharlotte, NC 28241', label: 'Additional interest — name and address', n: 'addlint', v: 'First Carolina Bank', match: 'contains', pts: 5, req: true },
    { key: 'mortgagee', label: 'Interest type — Mortgagee', n: 'CASymbols212', ...yes, pts: 4, req: true, hint: 'The bank holds the mortgage on the building, so check Mortgagee.' },
    { key: 'loan_no', label: 'Additional interest — Loan #', n: 'LOC7', v: '88-301557|88301557', match: 'any-of', pts: 5, req: true, hint: 'The bank needs the loan number exactly as given.' },
  ],

  // ------------------------------------------------------------------ ACORD 25 — Cascade Electric & Lighting / Westfield Development Group
  // Fillable "ACORD 25 Certificate of Liability Insurance.pdf" (ACORD 25 2016/03, standard ACORD field names).
  '25': [
    { key: 'issue_date', label: 'Date (top right)', n: 'Form_CompletionDate_A', v: '', match: 'present', pts: 2, hint: 'The date the certificate is issued (MM/DD/YYYY).' },
    { key: 'prod_name', sample: 'Summit Pro Insurance Services', label: 'Producer — agency name', n: 'Producer_FullName_A', v: 'Summit Pro Insurance', match: 'contains', pts: 3, req: true },
    { key: 'prod_addr1', sample: '2150 River Plaza Drive', label: 'Producer — street', n: 'Producer_MailingAddress_LineOne_A', v: '2150 River Plaza', match: 'contains', pts: 2 },
    { key: 'prod_addr2', sample: 'Suite 400', label: 'Producer — suite', n: 'Producer_MailingAddress_LineTwo_A', v: '400', match: 'contains', pts: 1, miss: 'optional', hint: 'Suite 400 may go on line one or line two.' },
    { key: 'prod_city', label: 'Producer — city', n: 'Producer_MailingAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 1 },
    { key: 'prod_state', sample: 'CA', label: 'Producer — state', n: 'Producer_MailingAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 1 },
    { key: 'prod_zip', label: 'Producer — ZIP', n: 'Producer_MailingAddress_PostalCode_A', v: '95833', match: 'contains', pts: 1 },
    { key: 'contact_name', label: 'Contact name', n: 'Producer_ContactPerson_FullName_A', v: 'Sarah Mitchell', match: 'contains', pts: 2 },
    { key: 'contact_phone', sample: '(916) 555-0120', label: 'Contact phone', n: 'Producer_ContactPerson_PhoneNumber_A', v: phone('555-0120'), match: 'contains', pts: 1 },
    { key: 'contact_fax', sample: '(916) 555-0121', label: 'Agency fax', n: 'Producer_FaxNumber_A', v: phone('555-0121'), match: 'contains', pts: 1, miss: 'optional' },
    { key: 'contact_email', label: 'Contact e-mail', n: 'Producer_ContactPerson_EmailAddress_A', v: 'sarah.mitchell@summitproins.com', match: 'exact', pts: 1, hint: 'Copy e-mail addresses character for character.' },
    { key: 'ins_name', sample: 'Cascade Electric & Lighting, Inc.', label: 'Insured — name', n: 'NamedInsured_FullName_A', v: 'Cascade Electric', match: 'contains', pts: 5, req: true },
    { key: 'ins_addr1', sample: '7310 Folsom Boulevard', label: 'Insured — street', n: 'NamedInsured_MailingAddress_LineOne_A', v: '7310 Folsom', match: 'contains', pts: 2 },
    { key: 'ins_addr2', sample: 'Suite B', label: 'Insured — suite', n: 'NamedInsured_MailingAddress_LineTwo_A', v: 'Suite B|Ste B', match: 'contains', pts: 1, miss: 'optional', hint: 'Suite B may go on line one or line two.' },
    { key: 'ins_city', label: 'Insured — city', n: 'NamedInsured_MailingAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 1 },
    { key: 'ins_state', sample: 'CA', label: 'Insured — state', n: 'NamedInsured_MailingAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 1 },
    { key: 'ins_zip', label: 'Insured — ZIP', n: 'NamedInsured_MailingAddress_PostalCode_A', v: '95826', match: 'contains', pts: 1 },
    { key: 'insurer_a', sample: 'Sierra Mutual Insurance Company', label: 'Insurer A — name', n: 'Insurer_FullName_A', v: 'Sierra Mutual', match: 'contains', pts: 3, req: true },
    { key: 'naic_a', label: 'Insurer A — NAIC #', n: 'Insurer_NAICCode_A', v: '24518', match: 'exact', pts: 2 },
    { key: 'insurer_b', sample: 'Golden Bear Workers Comp Insurance Company', label: 'Insurer B — name', n: 'Insurer_FullName_B', v: 'Golden Bear', match: 'contains', pts: 3, req: true },
    { key: 'naic_b', label: 'Insurer B — NAIC #', n: 'Insurer_NAICCode_B', v: '38812', match: 'exact', pts: 2 },
    { key: 'insurer_c', sample: 'Pacific Crest Excess Insurance Company', label: 'Insurer C — name', n: 'Insurer_FullName_C', v: 'Pacific Crest', match: 'contains', pts: 3, req: true },
    { key: 'naic_c', label: 'Insurer C — NAIC #', n: 'Insurer_NAICCode_C', v: '29440', match: 'exact', pts: 2 },

    { key: 'gl_ltr', label: 'General Liability — insurer letter', n: 'GeneralLiability_InsurerLetterCode_A', v: 'A', match: 'exact', pts: 2, hint: 'Use the letter of the insurer that writes the GL policy (Insurer A).' },
    { key: 'gl_cgl', label: 'Commercial General Liability box', n: 'GeneralLiability_CoverageIndicator_A', ...yes, pts: 2 },
    { key: 'gl_occ', label: 'GL — Occurrence', n: 'GeneralLiability_OccurrenceIndicator_A', ...yes, pts: 2 },
    { key: 'gl_per_project', label: 'GL — aggregate applies per Project', n: 'GeneralLiability_GeneralAggregate_LimitAppliesPerProjectIndicator_A', ...yes, pts: 2 },
    { key: 'gl_ai', sample: 'Y', label: 'GL — ADDL INSD', n: 'CertificateOfInsurance_GeneralLiability_AdditionalInsuredCode_A', v: 'Y|Yes|X', match: 'any-of', pts: 3, req: true, hint: 'The contract requires Westfield as additional insured on GL.' },
    { key: 'gl_subr', sample: 'Y', label: 'GL — SUBR WVD', n: 'Policy_GeneralLiability_SubrogationWaivedCode_A', v: 'Y|Yes|X', match: 'any-of', pts: 3 },
    { key: 'gl_pol', sample: 'CGL-5520187', label: 'GL — policy number', n: 'Policy_GeneralLiability_PolicyNumberIdentifier_A', v: 'CGL-5520187|CGL5520187', match: 'any-of', pts: 4, req: true, hint: 'Copy the policy number exactly, including any prefix.' },
    { key: 'gl_eff', label: 'GL — effective date', n: 'Policy_GeneralLiability_EffectiveDate_A', v: '03/01/2026', match: 'exact', pts: 2, hint: 'Dates use MM/DD/YYYY.' },
    { key: 'gl_exp', label: 'GL — expiration date', n: 'Policy_GeneralLiability_ExpirationDate_A', v: '03/01/2027', match: 'exact', pts: 2, hint: 'Dates use MM/DD/YYYY.' },
    { key: 'gl_each_occ', sample: '$1,000,000', label: 'GL — each occurrence', n: 'GeneralLiability_EachOccurrence_LimitAmount_A', v: money(1000000), match: 'any-of', pts: 2 },
    { key: 'gl_rented', sample: '$300,000', label: 'GL — damage to rented premises', n: 'GeneralLiability_FireDamageRentedPremises_EachOccurrenceLimitAmount_A', v: money(300000), match: 'any-of', pts: 1 },
    { key: 'gl_med', sample: '$10,000', label: 'GL — med exp (any one person)', n: 'GeneralLiability_MedicalExpense_EachPersonLimitAmount_A', v: money(10000), match: 'any-of', pts: 1 },
    { key: 'gl_pai', sample: '$1,000,000', label: 'GL — personal & adv injury', n: 'GeneralLiability_PersonalAndAdvertisingInjury_LimitAmount_A', v: money(1000000), match: 'any-of', pts: 1 },
    { key: 'gl_agg', sample: '$2,000,000', label: 'GL — general aggregate', n: 'GeneralLiability_GeneralAggregate_LimitAmount_A', v: money(2000000), match: 'any-of', pts: 2 },
    { key: 'gl_prod', sample: '$2,000,000', label: 'GL — products-comp/op agg', n: 'GeneralLiability_ProductsAndCompletedOperations_AggregateLimitAmount_A', v: money(2000000), match: 'any-of', pts: 1 },

    { key: 'au_ltr', label: 'Auto — insurer letter', n: 'Vehicle_InsurerLetterCode_A', v: 'A', match: 'exact', pts: 2 },
    { key: 'au_any', label: 'Auto — Any Auto', n: 'Vehicle_AnyAutoIndicator_A', ...yes, pts: 2 },
    { key: 'au_ai', sample: 'Y', label: 'Auto — ADDL INSD', n: 'CertificateOfInsurance_AutomobileLiability_AdditionalInsuredCode_A', v: 'Y|Yes|X', match: 'any-of', pts: 3, hint: 'The contract requires Westfield as additional insured on Auto too.' },
    { key: 'au_subr', sample: 'Y', label: 'Auto — SUBR WVD', n: 'Policy_AutomobileLiability_SubrogationWaivedCode_A', v: 'Y|Yes|X', match: 'any-of', pts: 2 },
    { key: 'au_pol', sample: 'BA-5520188', label: 'Auto — policy number', n: 'Policy_AutomobileLiability_PolicyNumberIdentifier_A', v: 'BA-5520188|BA5520188', match: 'any-of', pts: 3, req: true },
    { key: 'au_eff', label: 'Auto — effective date', n: 'Policy_AutomobileLiability_EffectiveDate_A', v: '03/01/2026', match: 'exact', pts: 1 },
    { key: 'au_exp', label: 'Auto — expiration date', n: 'Policy_AutomobileLiability_ExpirationDate_A', v: '03/01/2027', match: 'exact', pts: 1 },
    { key: 'au_csl', sample: '$1,000,000', label: 'Auto — combined single limit', n: 'Vehicle_CombinedSingleLimit_EachAccidentAmount_A', v: money(1000000), match: 'any-of', pts: 2 },

    { key: 'um_ltr', label: 'Umbrella — insurer letter', n: 'ExcessUmbrella_InsurerLetterCode_A', v: 'C', match: 'exact', pts: 2, hint: 'The umbrella is written by Insurer C.' },
    { key: 'um_type', label: 'Umbrella Liab box', n: 'Policy_PolicyType_UmbrellaIndicator_A', ...yes, pts: 2 },
    { key: 'um_occ', label: 'Umbrella — Occur', n: 'ExcessUmbrella_OccurrenceIndicator_A', ...yes, pts: 1 },
    { key: 'um_ret', label: 'Umbrella — Retention box', n: 'ExcessUmbrella_RetentionIndicator_A', ...yes, pts: 1 },
    { key: 'um_ret_amt', sample: '$10,000', label: 'Umbrella — retention amount', n: 'ExcessUmbrella_Umbrella_DeductibleOrRetentionAmount_A', v: money(10000), match: 'any-of', pts: 1 },
    { key: 'um_pol', sample: 'UMB-883104', label: 'Umbrella — policy number', n: 'Policy_ExcessLiability_PolicyNumberIdentifier_A', v: 'UMB-883104|UMB883104', match: 'any-of', pts: 3, req: true },
    { key: 'um_eff', label: 'Umbrella — effective date', n: 'Policy_ExcessLiability_EffectiveDate_A', v: '03/01/2026', match: 'exact', pts: 1 },
    { key: 'um_exp', label: 'Umbrella — expiration date', n: 'Policy_ExcessLiability_ExpirationDate_A', v: '03/01/2027', match: 'exact', pts: 1 },
    { key: 'um_occ_amt', sample: '$5,000,000', label: 'Umbrella — each occurrence', n: 'ExcessUmbrella_Umbrella_EachOccurrenceAmount_A', v: money(5000000), match: 'any-of', pts: 2 },
    { key: 'um_agg', sample: '$5,000,000', label: 'Umbrella — aggregate', n: 'ExcessUmbrella_Umbrella_AggregateAmount_A', v: money(5000000), match: 'any-of', pts: 1 },

    { key: 'wc_ltr', label: 'Workers Comp — insurer letter', n: 'WorkersCompensationEmployersLiability_InsurerLetterCode_A', v: 'B', match: 'exact', pts: 2, hint: 'Workers Comp is written by Insurer B.' },
    { key: 'wc_excl', sample: 'N', label: 'WC — any proprietor/officer excluded (Y/N)', n: 'WorkersCompensationEmployersLiability_AnyPersonsExcludedIndicator_A', v: 'N|No', match: 'any-of', pts: 1 },
    { key: 'wc_subr', sample: 'Y', label: 'WC — SUBR WVD', n: 'Policy_WorkersCompensation_SubrogationWaivedCode_A', v: 'Y|Yes|X', match: 'any-of', pts: 3, hint: 'The contract requires a waiver of subrogation on Workers Comp.' },
    { key: 'wc_pol', sample: 'WC-2290614', label: 'WC — policy number', n: 'Policy_WorkersCompensationAndEmployersLiability_PolicyNumberIdentifier_A', v: 'WC-2290614|WC2290614', match: 'any-of', pts: 3, req: true },
    { key: 'wc_eff', label: 'WC — effective date', n: 'Policy_WorkersCompensationAndEmployersLiability_EffectiveDate_A', v: '03/01/2026', match: 'exact', pts: 1 },
    { key: 'wc_exp', label: 'WC — expiration date', n: 'Policy_WorkersCompensationAndEmployersLiability_ExpirationDate_A', v: '03/01/2027', match: 'exact', pts: 1 },
    { key: 'wc_statute', label: 'WC — Per Statute', n: 'WorkersCompensationEmployersLiability_WorkersCompensationStatutoryLimitIndicator_A', ...yes, pts: 2 },
    { key: 'wc_el_acc', sample: '$1,000,000', label: 'E.L. each accident', n: 'WorkersCompensationEmployersLiability_EmployersLiability_EachAccidentLimitAmount_A', v: money(1000000), match: 'any-of', pts: 1 },
    { key: 'wc_el_emp', sample: '$1,000,000', label: 'E.L. disease — each employee', n: 'WorkersCompensationEmployersLiability_EmployersLiability_DiseaseEachEmployeeLimitAmount_A', v: money(1000000), match: 'any-of', pts: 1 },
    { key: 'wc_el_pol', sample: '$1,000,000', label: 'E.L. disease — policy limit', n: 'WorkersCompensationEmployersLiability_EmployersLiability_DiseasePolicyLimitAmount_A', v: money(1000000), match: 'any-of', pts: 1 },

    { key: 'desc_ops', sample: 'Re: Westfield Plaza Tenant Improvements, 2200 J Street, Sacramento, CA 95816. Westfield Development Group, LLC is an additional insured on the General Liability and Automobile Liability policies, and waiver of subrogation applies to General Liability, Automobile Liability and Workers Compensation, as required by written contract.', label: 'Description of operations', n: 'CertificateOfLiabilityInsurance_ACORDForm_RemarkText_A', v: 'Westfield Plaza 2200', match: 'keywords', pts: 4, req: true, hint: 'Name the project and its address, as the contract requires.' },
    { key: 'ch_name', sample: 'Westfield Development Group, LLC', label: 'Certificate holder — name', n: 'CertificateHolder_FullName_A', v: 'Westfield Development', match: 'contains', pts: 5, req: true },
    { key: 'ch_addr1', sample: '1100 Capital Mall', label: 'Certificate holder — street', n: 'CertificateHolder_MailingAddress_LineOne_A', v: '1100 Capital Mall', match: 'contains', pts: 2 },
    { key: 'ch_addr2', sample: 'Suite 500', label: 'Certificate holder — suite', n: 'CertificateHolder_MailingAddress_LineTwo_A', v: '500', match: 'contains', pts: 1, miss: 'optional', hint: 'Suite 500 may go on line one or line two.' },
    { key: 'ch_city', label: 'Certificate holder — city', n: 'CertificateHolder_MailingAddress_CityName_A', v: 'Sacramento', match: 'exact', pts: 2 },
    { key: 'ch_state', sample: 'CA', label: 'Certificate holder — state', n: 'CertificateHolder_MailingAddress_StateOrProvinceCode_A', v: state('CA', 'California'), match: 'any-of', pts: 1 },
    { key: 'ch_zip', label: 'Certificate holder — ZIP', n: 'CertificateHolder_MailingAddress_PostalCode_A', v: '95814', match: 'contains', pts: 2, hint: 'The holder ZIP (95814) differs from the project ZIP (95816).' },
    { key: 'signature', label: 'Authorized representative', n: 'Producer_AuthorizedRepresentative_Signature_A', v: 'Sarah Mitchell|Mitchell', match: 'contains', pts: 1, miss: 'optional', hint: 'Sarah Mitchell is the authorized representative.' },
  ],
};
