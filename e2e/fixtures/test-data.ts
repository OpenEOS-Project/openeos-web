/**
 * Test data for E2E tests
 * These credentials should match the seed data in the test database
 */

export const TEST_USER = {
  email: 'lukas@lukic-spitznagel.de',
  password: 'Muster123!',
  firstName: 'Test',
  lastName: 'User',
};

export const TEST_ADMIN = {
  email: 'admin@openeos.local',
  password: 'Admin123!',
  isSuperAdmin: true,
};

export const TEST_ORG = {
  name: 'Test Organisation',
  slug: 'test-org',
  eventCredits: 100,
};

export const TEST_EVENT = {
  name: 'Test Event',
  description: 'Ein Test-Event für E2E Tests',
  startDate: '2026-02-01',
  endDate: '2026-02-03',
};

export const TEST_CATEGORY = {
  name: 'Getränke',
  color: '#3B82F6',
};

export const TEST_PRODUCT = {
  name: 'Cola',
  price: '3.50',
  description: 'Erfrischungsgetränk',
};
