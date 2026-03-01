import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.dev so helpers can read VITE_*_API URLs (for api-client.js seeding/cleanup)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.dev') });

// E2E_BASE_URL must be set in .env.dev (gitignored) — no hardcoded URLs in committed files
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error(
    'E2E_BASE_URL not set. Add it to .env.dev:\n' +
    '  E2E_BASE_URL=https://<your-cloudfront-id>.cloudfront.net'
  );
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,          // run tests serially — they share DynamoDB state
  workers: 1,                    // single worker — all files share TEST_PARK_ID in DynamoDB
  retries: 1,                    // 1 retry for Lambda cold-start flakes
  timeout: 30_000,               // 30s per test
  expect: { timeout: 10_000 },   // 10s for assertions

  reporter: process.env.CI ? 'html' : 'list',

  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],

  outputDir: './test-results',
});
