export function describeScanWarnings(scan, { includeFrameworkHint = false } = {}) {
  const warnings = [];
  if (scan?.truncated) {
    warnings.push(
      `Note: scanner stopped at ${scan.maxFiles} source files. Raise \`scan.max_files\` in .draftwise/config.yaml for fuller coverage.`,
    );
  }
  if (includeFrameworkHint && (scan?.frameworks?.length ?? 0) === 0) {
    warnings.push(
      "Heads up: no framework detected. Draftwise's scanner supports JS/TS (Next.js, Express, Fastify, Vue, Svelte) and common ORMs (Prisma, Mongoose, Drizzle). Other languages will produce shallow scans until language-specific support lands.",
    );
  }
  return warnings;
}
