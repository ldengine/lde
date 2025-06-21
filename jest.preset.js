const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset, // https://github.com/nrwl/nx/blob/master/packages/jest/preset/jest-preset.ts
  extensionsToTreatAsEsm: ['.ts'], // Added to make importing ESM-only modules work in Jest tests. See also the .env file.
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text'],
};
