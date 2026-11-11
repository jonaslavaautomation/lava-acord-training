import type { AcordModule, AcordId } from '../types';

export const MODULE_125: AcordModule = {
  id: '125',
  formNumber: 'ACORD 125',
  title: 'Commercial Insurance Application',
  description: 'The foundational application capturing applicant identity, business operations, and coverage requests for all commercial lines.',
  category: 'Application',
  videoTitle: 'ACORD 125 — Commercial Application Walkthrough',
  videoDescription: 'Learn how to complete the applicant section, identify business operations, and coordinate coverage requests across all commercial lines.',
  videoDuration: '18:42',
  introduction: {
    purpose: 'The ACORD 125 is the master commercial insurance application used to capture the core identity and operational profile of a business applicant. It serves as the umbrella form for all commercial line submissions, with individual line schedules (ACORD 126, 127, 130, 140) attached as needed.',
    agencyRole: 'Producers and account managers use the 125 to establish the policyholder of record, document the nature of the business, and request the specific lines of coverage. Underwriters rely on it as the entry point to the entire account, so accuracy and completeness directly impact quoting speed.',
    keySections: [
      { title: 'Applicant Information', description: 'Legal business name, DBA, mailing and physical addresses, contact details.' },
      { title: 'Insurance Experience', description: 'Prior carrier, policy number, expiration date, and loss history references.' },
      { title: 'Applicant Business Operations', description: 'Description of operations, products, services, annual revenue, payroll, and employee counts.' },
      { title: 'Additional Interests', description: 'List of certificate holders, additional insureds, and mortgagees.' },
    ],
    learningObjectives: [
      'Correctly distinguish legal entity name from DBA and trade names.',
      'Capture complete mailing and physical addresses including suite and county.',
      'Document business operations with enough detail for an underwriter to classify the risk.',
      'Identify which line schedules must accompany the 125 based on requested coverage.',
      'Properly list additional insureds and certificate holders with accurate mailing addresses.',
    ],
  },
  scenario: {
    from: 'sarah.mitchell@summitproins.com',
    fromName: 'Sarah Mitchell, Producer',
    to: 'va-team@lavaagency.com',
    subject: 'New Commercial Submission — Riverstone Construction Co.',
    date: 'Nov 12, 2026 — 9:14 AM',
    body: `Hi team,

Please prepare a commercial insurance application for a new prospect. Below is everything the insured provided during our intake call this morning.

INSURED INFORMATION
Legal Business Name: Riverstone Construction Co., LLC
DBA: Riverstone Builders
Mailing Address: 4820 Industrial Parkway, Suite 220, Sacramento, CA 95841
Physical Address: 4820 Industrial Parkway, Suite 220, Sacramento, CA 95841
Contact: Marcus Chen, Operations Manager
Phone: (916) 555-0142
Email: mchen@riverstoneconstruction.com

BUSINESS OPERATIONS
General contractor specializing in commercial builds. Approximately 35 employees across field and office. Annual gross receipts ~$4.2M. Payroll roughly $1.8M. They do light demolition, concrete work, framing, and finish carpentry. No residential work.

COVERAGE REQUESTED
- General Liability
- Workers Compensation
- Commercial Auto (fleet of 12 vehicles)
- Commercial Property (office + equipment)

ADDITIONAL NOTES
- Prior carrier was Travelers, policy expiring 01/15/2027.
- They need an additional insured listed for their largest client: Westfield Development Group, 1100 Capital Mall, Sacramento, CA 95814.
- Certificate holder requested on all policies.

Please complete the ACORD 125 with the information above and let me know if anything is missing before I send to underwriting.

Thanks,
Sarah`,
    attachments: ['Riverstone_Construction_LOA.pdf', 'Loss_Run_2024.pdf'],
  },
};

export const MODULE_126: AcordModule = {
  id: '126',
  formNumber: 'ACORD 126',
  title: 'Commercial General Liability',
  description: 'Captures general liability exposure details including operations, premises, products, and completed work.',
  category: 'Liability',
  videoTitle: 'ACORD 126 — General Liability Schedule',
  videoDescription: 'Understand GL classification codes, exposure bases, and how to document premises and operations accurately.',
  videoDuration: '22:15',
  introduction: {
    purpose: 'The ACORD 126 is the General Liability schedule that attaches to the ACORD 125. It details the insured\'s liability exposures by classification code, exposure basis (sales, payroll, area, units), and coverage limits requested.',
    agencyRole: 'Producers use the 126 to translate a business\'s operations into GL classification codes and exposure numbers that underwriters use to build a premium quote. Accuracy in class codes and exposure estimates directly affects pricing and audit outcomes.',
    keySections: [
      { title: 'Classification & Exposure', description: 'Class codes, exposure basis, and estimated annual amounts.' },
      { title: 'Premises Information', description: 'Each location with its code, square footage, and ownership status.' },
      { title: 'Products & Completed Operations', description: 'Description of products and work performed away from premises.' },
      { title: 'Limits & Deductibles', description: 'Occurrence and aggregate limits, products/completed ops aggregate.' },
    ],
    learningObjectives: [
      'Select the correct classification code based on operations described in the scenario.',
      'Identify the proper exposure basis (payroll, sales, area, cost, units) for each class.',
      'Document premises with complete addresses and square footage.',
      'Request appropriate occurrence and aggregate limits.',
      'Distinguish between premises liability and products/completed operations exposure.',
    ],
  },
  scenario: {
    from: 'james.ortiz@bluebridgeins.com',
    fromName: 'James Ortiz, Account Manager',
    to: 'va-team@lavaagency.com',
    subject: 'GL Quote — Harvest Kitchen & Market, LLC',
    date: 'Nov 10, 2026 — 2:38 PM',
    body: `Team,

We need a General Liability quote prepared for a new restaurant client. Here are the details from the intake:

INSURED
Harvest Kitchen & Market, LLC
248 Bayview Boulevard, Portland, OR 97201
Owner: Elena Rodriguez
Phone: (503) 555-0198

OPERATIONS
Full-service restaurant and small market area selling local goods. They seat about 80 guests. Kitchen staff of 12. They also do light catering off-site for private events (roughly 20 events/year, ~$45K in catering revenue).

PREMISES
Leased location, 4,200 sq ft total. Single location.

REQUESTED LIMITS
$1,000,000 / $2,000,000 occurrence and aggregate
$1,000,000 products/completed ops aggregate
$5,000 deductible

Prior carrier: Hartford, expiring 03/01/2027, no claims in 3 years.

Please complete the ACORD 126 so we can send to three markets.

Thanks,
James`,
  },
};

export const MODULE_127: AcordModule = {
  id: '127',
  formNumber: 'ACORD 127',
  title: 'Business Auto',
  description: 'Documents commercial vehicle schedules, coverage symbols, garaging, and driver information.',
  category: 'Auto',
  videoTitle: 'ACORD 127 — Business Auto Schedule',
  videoDescription: 'Master the coverage symbol system, vehicle scheduling, and driver listing for commercial auto.',
  videoDuration: '16:30',
  introduction: {
    purpose: 'The ACORD 127 is the Business Auto schedule used to list vehicles, drivers, and coverage options for commercial fleets. It relies on a numbered symbol system (1-9) to define which vehicles are covered for each coverage type.',
    agencyRole: 'Account managers use the 127 to schedule each vehicle with its VIN, cost new, garaging address, and radius of operation. Coverage symbols must be chosen carefully—an error here can mean a vehicle is unknowingly uninsured.',
    keySections: [
      { title: 'Coverage Selection', description: 'Symbol codes for liability, physical damage, and additional coverages.' },
      { title: 'Vehicle Schedule', description: 'Year, make, model, VIN, cost new, and garaging zip for each unit.' },
      { title: 'Driver Information', description: 'Licensed drivers with license numbers, states, and DOB.' },
      { title: 'Limits & Deductibles', description: 'Liability limits, uninsured motorist, and comprehensive/collision deductibles.' },
    ],
    learningObjectives: [
      'Apply the correct coverage symbol (1-9) for liability and physical damage.',
      'Schedule vehicles with complete VIN, cost new, and garaging information.',
      'List all licensed drivers with accurate license state and DOB.',
      'Set appropriate liability limits and deductibles.',
      'Identify when to use symbol 1 (any auto) vs symbol 2 (scheduled autos).',
    ],
  },
  scenario: {
    from: 'patricia.nguyen@cornerstoneins.com',
    fromName: 'Patricia Nguyen, Producer',
    to: 'va-team@lavaagency.com',
    subject: 'Business Auto Quote — GreenLine Logistics',
    date: 'Nov 11, 2026 — 11:20 AM',
    body: `Hi all,

New auto quote request for a logistics company. Details below:

INSURED
GreenLine Logistics, Inc.
7550 Freight Terminal Road, Dallas, TX 75207
Contact: David Okoro, Fleet Manager — (214) 555-0177

VEHICLES (fleet of 8)
1. 2022 Freightliner Cascadia, VIN 1FUJGHDV0LLAB1234, Cost new $145,000, Garaging ZIP 75207
2. 2021 Peterbilt 579, VIN 1XPBDP9X1MD7823456, Cost new $138,000, Garaging ZIP 75207
3. 2023 Kenworth T680, VIN 2NKHHM7X4PM8901234, Cost new $150,000, Garaging ZIP 75207
4. 2020 Volvo VNL, VIN 4V4NC9EH0LN5678901, Cost new $125,000, Garaging ZIP 75207
5. 2022 International LT, VIN 3HSDZAPR0NN2345678, Cost new $142,000, Garaging ZIP 75207
6. 2019 Mack Anthem, VIN 1M1AN09Y3KP3456789, Cost new $120,000, Garaging ZIP 75207
7. 2021 Freightliner M2 Box Truck, VIN 1FVACWDT8RHJA6789, Cost new $85,000, Garaging ZIP 75207
8. 2020 Ford Transit, VIN 1FTBR2X80LKA89012, Cost new $42,000, Garaging ZIP 75207

DRIVERS (5 full-time)
1. David Okoro, DL# O4589123, TX, DOB 04/12/1985, MVR clean
2. Maria Santos, DL# S2278901, TX, DOB 09/23/1988, MVR clean
3. Tyrone Johnson, DL# J1190345, TX, DOB 02/15/1990, 1 speeding 2024
4. Ahmed Hassan, DL# H8890234, TX, DOB 11/30/1982, MVR clean
5. Lisa Chen, DL# C5567890, TX, DOB 06/18/1995, MVR clean

COVERAGE REQUESTED
- Liability: $1,000,000 CSL
- Symbol 1 (any auto) for liability
- Physical damage: comprehensive and collision, $1,000 deductible
- Symbol 2 (scheduled autos) for physical damage
- Uninsured/Underinsured Motorist: $1,000,000
- Medical payments: $10,000
- Hired & Non-owned auto liability

Radius: 500 miles

Please complete the ACORD 127. Thanks!

Patricia`,
  },
};

export const MODULE_130: AcordModule = {
  id: '130',
  formNumber: 'ACORD 130',
  title: 'Workers Compensation',
  description: 'Captures workers comp class codes, payroll by class, and employer/owner information.',
  category: 'Workers Comp',
  videoTitle: 'ACORD 130 — Workers Compensation Application',
  videoDescription: 'Learn class code assignment, payroll estimation by class, and owner/officer inclusion.',
  videoDuration: '20:08',
  introduction: {
    purpose: 'The ACORD 130 is the Workers Compensation application that documents employer information, class codes, estimated annual payroll by class, and owner/officer inclusion or exclusion. It is submitted to the carrier for rating and to the state bureau where required.',
    agencyRole: 'Producers and CSR teams use the 130 to translate a business\'s job functions into NCCI or state class codes with payroll estimates. These numbers drive the premium, and errors lead to audit discrepancies and E&O exposure.',
    keySections: [
      { title: 'Employer Information', description: 'Legal name, FEIN, nature of business, and states of operation.' },
      { title: 'Class Codes & Payroll', description: 'Each class code with estimated annual payroll and number of employees.' },
      { title: 'Owner/Officer Information', description: 'Officers and owners with inclusion/exclusion status and ownership %.' },
      { title: 'Limits & Other States', description: 'Statutory limits, Part Two/Three, and other-state coverage listing.' },
    ],
    learningObjectives: [
      'Assign correct NCCI class codes based on job descriptions.',
      'Estimate annual payroll per class code from scenario data.',
      'Properly include or exclude owner/officers with ownership percentage.',
      'Document the FEIN and states of operation.',
      'Identify when Other States coverage is needed and list specific states.',
    ],
  },
  scenario: {
    from: 'michael.brennan@alliedriskins.com',
    fromName: 'Michael Brennan, Producer',
    to: 'va-team@lavaagency.com',
    subject: 'WC Submission — Summit Roofing & Solar',
    date: 'Nov 9, 2026 — 8:45 AM',
    body: `Morning team,

WC quote for a roofing and solar installation company. Details:

EMPLOYER
Summit Roofing & Solar, LLC
3200 Commerce Center Drive, Denver, CO 80205
FEIN: 84-3920174
Contact: Rachel Kim, Office Manager — (303) 555-0123
Nature of business: Residential and commercial roofing + rooftop solar panel installation

CLASS CODES & PAYROLL (estimated annual)
1. 5551 — Roofing — $850,000 payroll, 18 employees
2. 5190 — Solar panel installation (electrical work) — $420,000 payroll, 8 employees
3. 8810 — Clerical/Office — $280,000 payroll, 4 employees
4. 7380 — Sales/Outside — $190,000 payroll, 5 employees

OWNERS/OFFICERS
1. Tyler Brennan, President, 60% owner, Include in coverage, annual salary $120,000
2. Nicole Park, VP Operations, 30% owner, Include in coverage, annual salary $95,000
(Third partner, 10% owner, is passive — not included)

COVERAGE
- Statutory WC limits per CO law
- Part Two: Employer's Liability — $1,000,000/$1,000,000/$1,000,000
- Other states coverage: UT, WY, NM, AZ (they operate across mountain west)

Prior carrier: AmTrust, expiring 06/30/2027. One lost-time claim in 2024 (~$28K).

Please complete the ACORD 130.

Michael`,
  },
};

export const MODULE_140: AcordModule = {
  id: '140',
  formNumber: 'ACORD 140',
  title: 'Commercial Property',
  description: 'Documents building and contents values, construction details, and property coverage.',
  category: 'Property',
  videoTitle: 'ACORD 140 — Commercial Property Schedule',
  videoDescription: 'Capture building characteristics, occupancy, protection, and exposure details for property rating.',
  videoDuration: '19:55',
  introduction: {
    purpose: 'The ACORD 140 is the Commercial Property schedule documenting building and business personal property values, construction class, occupancy, protection class, and cause of loss. It drives the property premium and determines how a loss will be settled.',
    agencyRole: 'Producers and CSRs use the 140 to capture the insurance-to-value data underwriters need: building replacement cost, contents value, construction class (1-6), protection class (1-10), and causes of loss (basic, broad, special). Inaccurate values cause coinsurance penalties at claim time.',
    keySections: [
      { title: 'Location & Building', description: 'Address, construction class, year built, square footage, and occupancy.' },
      { title: 'Values', description: 'Building, business personal property, and time element values.' },
      { title: 'Causes of Loss & Limits', description: 'Basic/broad/special, deductible, and coinsurance percentage.' },
      { title: 'Protection & Exposure', description: 'Protection class, sprinkler status, and distance to fire hydrant.' },
    ],
    learningObjectives: [
      'Identify the correct construction class (1-6) from building materials.',
      'Document building replacement cost and BPP values separately.',
      'Select the appropriate cause of loss form (basic, broad, special).',
      'Record protection class and sprinkler information.',
      'Identify coinsurance requirements and their implications.',
    ],
  },
  scenario: {
    from: 'karen.delgado@pinnaclesurety.com',
    fromName: 'Karen Delgado, Account Executive',
    to: 'va-team@lavaagency.com',
    subject: 'Property Quote — BlueRidge Manufacturing Facility',
    date: 'Nov 8, 2026 — 3:15 PM',
    body: `Hi team,

Property quote for a manufacturing client. Full details:

INSURED
BlueRidge Manufacturing, Inc.
1500 Industrial Park Lane, Asheville, NC 28806
Contact: Steve Hanlon, Facilities Director — (828) 555-0165

BUILDING
Single building, 28,000 sq ft manufacturing facility
Year built: 1998, fully renovated electrical in 2020
Construction: Joisted masonry (Class 2)
Roof: Flat built-up roof, replaced 2021
Occupancy: Custom furniture manufacturing — wood shop and assembly floor
Protection class: 4
Sprinklered: Yes — fully wet-pipe sprinkler system throughout
Distance to nearest fire hydrant: 250 feet
Distance to nearest fire station: 1.2 miles

VALUES
Building replacement cost: $2,850,000
Business personal property (machinery, inventory, stock): $1,650,000
Business income: 12 months, estimated annual revenue $3,200,000

COVERAGE REQUESTED
- Causes of loss: Special form
- Deductible: $2,500
- Coinsurance: 80%
- Replacement cost on building and contents
- Ordinance or law coverage requested
- Earthquake: excluded
- Backup of sewer/drain: included

Prior carrier: Travelers, expiring 09/01/2027, no property claims in 5 years.

Please prepare the ACORD 140.

Karen`,
  },
};

export const ACORD_MODULES: AcordModule[] = [MODULE_125, MODULE_126, MODULE_127, MODULE_130, MODULE_140];

export const MODULE_MAP: Record<AcordId, AcordModule> = Object.fromEntries(
  ACORD_MODULES.map((m) => [m.id, m]),
) as Record<AcordId, AcordModule>;
