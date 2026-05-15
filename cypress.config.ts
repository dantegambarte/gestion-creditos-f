import { defineConfig } from 'cypress';

export default defineConfig({
  env: {
    realAuthEnabled: false,
    realAdminDni: '00000000',
    realAdminPassword: 'admin123',
    realSellerDni: '11111111',
    realSellerPassword: '123456',
    realCollectorDni: '22222222',
    realCollectorPassword: '123456',
  },
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 8000,
    video: false,
    screenshotOnRunFailure: true,

    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: 'cypress/reports/mocha',
      quite: true,
      overwrite: false,
      html: false,
      json: true,
    },
  },
});
