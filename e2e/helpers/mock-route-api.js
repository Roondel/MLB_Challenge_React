/**
 * Intercepts calls to the route-matrix API (/api/route) so e2e tests never
 * spend real Google Maps quota, regardless of what VITE_USE_REAL_MAPS is set
 * to on the deployed environment E2E_BASE_URL points at.
 *
 * An empty matrix makes suggestScheduleRoute() fall back to haversine for
 * every pair (see resolveDistance() in tripPlanner.js) — identical to the
 * app's pre-real-Maps behavior, so no existing assertions need to change.
 */
export async function mockRouteMatrixApi(page) {
  await page.route('**/api/route', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ matrix: [] }),
    });
  });
}
