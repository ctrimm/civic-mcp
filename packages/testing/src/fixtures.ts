/**
 * Shared test fixtures — realistic but fake user data for adapter tests.
 *
 * None of these values correspond to real individuals. Use these as defaults
 * in tests so that adapters are tested with plausible inputs.
 */

export const TEST_HOUSEHOLDS = {
  /** Single adult below poverty line */
  single_low_income: {
    householdSize: 1,
    monthlyIncome: 900,
    annualIncome: 10_800,
  },

  /** Family of 3, moderate income */
  family_moderate: {
    householdSize: 3,
    monthlyIncome: 2_500,
    annualIncome: 30_000,
  },

  /** Family of 4, above SNAP limit */
  family_above_limit: {
    householdSize: 4,
    monthlyIncome: 6_000,
    annualIncome: 72_000,
  },

  /** Elderly individual */
  elderly_single: {
    householdSize: 1,
    monthlyIncome: 1_100,
    annualIncome: 13_200,
    elderly: true,
  },
};

export const TEST_PERSONS = {
  primary: {
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: '01/15/1985',
    ssn: '000-00-0001', // Not a real SSN
    email: 'jane.smith.test@example.com',
    phone: '555-555-0100',
  },
  secondary: {
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '03/22/1982',
    ssn: '000-00-0002',
    email: 'john.smith.test@example.com',
    phone: '555-555-0101',
  },
};

export const TEST_ADDRESSES = {
  colorado: {
    street: '123 Test St',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
  },
  california: {
    street: '456 Sample Ave',
    city: 'Sacramento',
    state: 'CA',
    zip: '95814',
  },
  michigan: {
    street: '789 Demo Blvd',
    city: 'Lansing',
    state: 'MI',
    zip: '48933',
  },
  texas: {
    street: '321 Example Rd',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
  },
};

/** Helper to build a complete eligibility check payload */
export function eligibilityPayload(
  household: keyof typeof TEST_HOUSEHOLDS,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...TEST_HOUSEHOLDS[household], ...overrides };
}
