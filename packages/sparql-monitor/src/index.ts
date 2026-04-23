/**
 * @lde/sparql-monitor has been renamed to @lde/distribution-monitor. This
 * package is a thin re-export shim kept for one minor version so that
 * existing installs keep working while consumers migrate. It will be removed
 * from the workspace once the deprecation has shipped.
 */
console.warn(
  '[@lde/sparql-monitor] This package is deprecated. ' +
    'Update your dependency to @lde/distribution-monitor. ' +
    'See https://github.com/ldelements/lde/tree/main/packages/distribution-monitor',
);

export * from '@lde/distribution-monitor';
