// Test constants — use Arizona Diamondbacks (teamId 109, Chase Field) as the primary test park
// This park is unlikely to have real user data colliding with E2E tests.

export const TEST_PARK_ID = 109;
export const TEST_PARK_PATH = '/parks/109';

// Second park for multi-park trip tests
export const TEST_PARK_ID_2 = '110';

// DynamoDB
export const TABLE_NAME = process.env.E2E_TABLE_NAME || 'mlb-challenge-dev';
export const AWS_REGION = 'eu-west-1';

// A default visit payload for seeding
export const SEED_VISIT = {
  parkId: TEST_PARK_ID,
  date: '2025-07-04',
  rating: 4,
  notes: 'E2E test visit',
  photoKeys: [],
  opponent: 'Dodgers',
  score: 'ARI 5 - LAD 3',
  gameAttended: true,
  weather: '95°F, Sunny',
};

// A default trip payload for seeding
// Fields must match what TripPlannerPage expects: selectedParks, routeResult, etc.
export const SEED_TRIP = {
  tripId: 'e2e-test-trip-001',
  name: 'E2E Test Trip',
  selectedParks: [TEST_PARK_ID, TEST_PARK_ID_2],
  routeResult: null,
  startDate: '2025-07-01',
  endDate: '2025-07-10',
  startCity: 'Phoenix, AZ',
  savedAt: new Date().toISOString(),
};
