// Test constants — use Arizona Diamondbacks (teamId 109, Chase Field) as the primary test park
// This park is unlikely to have real user data colliding with E2E tests.

export const TEST_PARK_ID = 109;
export const TEST_PARK_PATH = '/parks/109';

// Second park for multi-park trip tests
export const TEST_PARK_ID_2 = '110';

// DynamoDB
export const TABLE_NAME = process.env.E2E_TABLE_NAME || 'mlb-challenge-dev';
export const AWS_REGION = 'eu-west-1';

// Cognito sub for the dedicated E2E test user.
// Set E2E_TEST_USER_SUB in .env.dev after creating the user via:
//   aws cognito-idp admin-create-user ...
//   aws cognito-idp admin-set-user-password --permanent ...
export const TEST_USER_SUB = process.env.E2E_TEST_USER_SUB || 'e2e-placeholder-sub';

// S3 photo key uses the test user's sub (Phase 3 — userId in path)
export const PHOTO_S3_KEY = `photos/${TEST_USER_SUB}/${TEST_PARK_ID}/photo.jpg`;

// A default visit payload for seeding
// Uses backend field names (as stored in DynamoDB) — api.js maps these on the way in/out.
export const SEED_VISIT = {
  parkId:       TEST_PARK_ID,
  date:         '2025-07-04',
  rating:       4,
  notes:        'E2E test visit',
  photoKeys:    [],
  opponent:     'Dodgers',
  score:        'ARI 5 - LAD 3',
  gameAttended: true,
  weather:      '95°F, Sunny',
};

// A default trip payload for seeding
// Fields must match what the trips Lambda expects after Phase 3
export const SEED_TRIP = {
  tripId:    'e2e-test-trip-001',
  name:      'E2E Test Trip',
  parks:     [TEST_PARK_ID, TEST_PARK_ID_2],
  itinerary: null,
  startDate: '2025-07-01',
  endDate:   '2025-07-10',
  startCity: 'Phoenix, AZ',
};
