// Playwright config — refactor öncesi güvenlik ağı (regression suite)
// Sequential mode: testler state isolation için ardarda çalışır.
// Tek chromium browser: hızlı CI + production karakteristiği.

module.exports = {
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "tests/_report", open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 8000,
    navigationTimeout: 15000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
};
