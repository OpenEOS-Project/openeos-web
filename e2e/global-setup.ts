import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  // Launch browser for health check
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Health check - wait for the app to be ready
    console.log(`Checking if app is ready at ${baseURL}...`);
    await page.goto(baseURL!, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('App is ready!');
  } catch (error) {
    console.error('Failed to connect to the application:', error);
    throw new Error(`Could not connect to ${baseURL}. Make sure the dev server is running.`);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
