// Trim a raw scan result down to a prompt-sized projection.
//
// We cap the noisy fields (components at 50, sample files at 30) so big
// repos don't blow the prompt window with irrelevant detail. The cap
// values live here, in one place, so a future tuning pass affects every
// command identically.
export function compactScan(result) {
  return {
    frameworks: result.frameworks,
    orms: result.orms,
    routes: result.routes,
    components: result.components.slice(0, 50),
    models: result.models,
    fileCount: result.files.length,
    sampleFiles: result.files.slice(0, 30),
  };
}
