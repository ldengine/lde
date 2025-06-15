const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  extensionsToTreatAsEsm: ['.ts'], // Added to make importing ESM-only modules work in Jest tests. See also the .env file.
};
