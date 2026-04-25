// Narrow scanner output to items that look related to a named flow.
// The filter is a heuristic — we tokenize the flow name and keep
// routes / components / models whose paths or names contain any token.
// If filtering wipes out everything in a category that originally had
// items, we fall back to the original (unfiltered) data — better to
// over-include than to leave the model staring at empty arrays.

export function filterScanForFlow(scan, flow) {
  if (!scan || !flow) return scan;
  const tokens = tokenize(flow);
  if (tokens.length === 0) return scan;

  const includes = (text) => {
    if (!text) return false;
    const lower = String(text).toLowerCase();
    return tokens.some((t) => lower.includes(t));
  };

  const filterArr = (arr, fields) => {
    if (!Array.isArray(arr)) return arr;
    return arr.filter((item) =>
      fields.some((f) => includes(typeof item === 'string' ? item : item?.[f])),
    );
  };

  const filteredRoutes = filterArr(scan.routes, ['path', 'file', 'name']);
  const filteredComponents = filterArr(scan.components, ['name', 'file']);
  const filteredModels = filterArr(scan.models, ['name', 'file']);

  return {
    ...scan,
    routes: pickFiltered(scan.routes, filteredRoutes),
    components: pickFiltered(scan.components, filteredComponents),
    models: pickFiltered(scan.models, filteredModels),
    flowFilter: {
      flow,
      tokens,
      // Whether we actually filtered or fell back per-category
      routes: filteredRoutes.length > 0 || (scan.routes ?? []).length === 0,
      components:
        filteredComponents.length > 0 || (scan.components ?? []).length === 0,
      models: filteredModels.length > 0 || (scan.models ?? []).length === 0,
    },
  };
}

function tokenize(flow) {
  return String(flow)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t.length > 1);
}

function pickFiltered(original, filtered) {
  if (!Array.isArray(original)) return filtered;
  if (filtered.length === 0 && original.length > 0) return original;
  return filtered;
}
