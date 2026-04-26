import { readdir, readFile, access } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { mapConcurrent } from '../utils/concurrency.js';

// Cap concurrent file reads. Far below typical fd limits and high enough
// to give a meaningful speedup over sequential reads on big repos.
const READ_CONCURRENCY = 50;

export const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.draftwise',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.cache',
  '.vite',
  '.parcel-cache',
  // Python
  '__pycache__',
  'venv',
  '.venv',
  'env',
  '.env-dir',
  '.tox',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'site-packages',
  'eggs',
  '.eggs',
]);

export const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.tsx', '.mts', '.cts',
  '.vue', '.svelte',
  '.py',
  '.go',
  '.rs',
  '.rb',
  '.java', '.kt', '.kts',
  '.swift',
  '.php',
  '.cs',
  '.c', '.cc', '.cpp', '.h', '.hpp',
]);

const COMPONENT_EXTENSIONS = new Set(['.jsx', '.tsx', '.vue', '.svelte']);

const FRAMEWORK_DEPS = {
  // JS / TS
  next: 'Next.js',
  '@remix-run/react': 'Remix',
  'react-router-dom': 'React Router',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  '@sveltejs/kit': 'SvelteKit',
  nuxt: 'Nuxt',
  express: 'Express',
  fastify: 'Fastify',
  '@hapi/hapi': 'Hapi',
  koa: 'Koa',
  '@nestjs/core': 'NestJS',
  // Python
  fastapi: 'FastAPI',
  starlette: 'Starlette',
  flask: 'Flask',
  django: 'Django',
  tornado: 'Tornado',
};

const ORM_DEPS = {
  // JS / TS
  '@prisma/client': 'Prisma',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  sequelize: 'Sequelize',
  'drizzle-orm': 'Drizzle',
  typeorm: 'TypeORM',
  knex: 'Knex',
  // Python
  sqlalchemy: 'SQLAlchemy',
  'sqlalchemy-utils': 'SQLAlchemy',
  alembic: 'SQLAlchemy',
  django: 'Django ORM',
  peewee: 'Peewee',
  'tortoise-orm': 'Tortoise ORM',
};

const PY_FILE_RE = /\.py$/;
const PY_TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__)\/|\/test_|^test_|\/conftest\.py$|_test\.py$/;

export const DEFAULT_MAX_FILES = 5000;

export async function scan(root, options = {}) {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const files = [];
  const state = { count: 0, max: maxFiles, truncated: false };
  await walk(root, root, files, state);

  const packageMeta = await readProjectMeta(root);
  const frameworks = detectFrameworks(packageMeta);
  const orms = detectOrms(packageMeta);

  const components = files
    .filter((f) => COMPONENT_EXTENSIONS.has(extOf(f)))
    .map((file) => ({ name: baseName(file), file }));

  const routes = await detectRoutes(root, files, frameworks);
  const models = await detectModels(root, files, orms);

  return {
    root,
    files,
    packageMeta,
    frameworks,
    orms,
    routes,
    components,
    models,
    truncated: state.truncated,
    maxFiles,
  };
}

async function walk(root, dir, out, state) {
  if (state.truncated) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (state.truncated) return;
    if (IGNORE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out, state);
    } else if (entry.isFile()) {
      if (CODE_EXTENSIONS.has(extOf(entry.name))) {
        if (state.count >= state.max) {
          state.truncated = true;
          return;
        }
        out.push(toPosix(relative(root, full)));
        state.count++;
      }
    }
  }
}

function extOf(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function baseName(file) {
  const slash = file.lastIndexOf('/');
  const name = slash < 0 ? file : file.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
}

function toPosix(p) {
  return p.split(sep).join('/');
}

async function readProjectMeta(root) {
  const node = await readPackageJson(root);
  const py = await readPythonProject(root);
  if (!node && !py) return null;

  const languages = [];
  if (node) languages.push('javascript');
  if (py) languages.push('python');

  return {
    name: node?.name ?? py?.name,
    version: node?.version ?? py?.version,
    description: node?.description ?? py?.description,
    dependencies: [
      ...(node?.dependencies ?? []),
      ...(py?.dependencies ?? []),
    ],
    devDependencies: [
      ...(node?.devDependencies ?? []),
      ...(py?.devDependencies ?? []),
    ],
    languages,
  };
}

async function readPackageJson(root) {
  const path = join(root, 'package.json');
  try {
    const raw = await readFile(path, 'utf8');
    const pkg = JSON.parse(raw);
    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      dependencies: Object.keys(pkg.dependencies ?? {}),
      devDependencies: Object.keys(pkg.devDependencies ?? {}),
    };
  } catch {
    return null;
  }
}

// Lightweight Python project metadata reader. Tries pyproject.toml first
// (PEP 621 [project] and Poetry [tool.poetry]), falls back to requirements.txt.
async function readPythonProject(root) {
  const pyproject = await tryReadPyproject(root);
  if (pyproject) return pyproject;
  const requirements = await tryReadRequirementsTxt(root);
  if (requirements) return requirements;
  return null;
}

async function tryReadPyproject(root) {
  const path = join(root, 'pyproject.toml');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return null;
  }

  // Minimal TOML parsing — we only need project name, version, description,
  // and dependency lists. Real TOML parsing is overkill for v1.
  const sections = parseTomlSections(raw);
  const project = sections['project'] ?? sections['tool.poetry'] ?? {};

  const deps = [];
  // PEP 621 dependencies = [...] (array of strings like "fastapi >= 0.100")
  const depList = parseTomlArrayString(sections['project'], 'dependencies');
  for (const entry of depList) {
    const name = pythonRequirementName(entry);
    if (name) deps.push(name);
  }

  // Poetry [tool.poetry.dependencies] is a table with package = "version" lines
  const poetryDeps = sections['tool.poetry.dependencies'] ?? {};
  for (const key of Object.keys(poetryDeps)) {
    if (key === 'python') continue;
    deps.push(key);
  }

  const devDeps = [];
  const poetryDev = sections['tool.poetry.dev-dependencies'] ?? sections['tool.poetry.group.dev.dependencies'] ?? {};
  for (const key of Object.keys(poetryDev)) {
    devDeps.push(key);
  }

  // PEP 621 optional-dependencies (e.g. [project.optional-dependencies] dev = [...])
  const optDevList = parseTomlArrayString(
    sections['project.optional-dependencies'],
    'dev',
  );
  for (const entry of optDevList) {
    const name = pythonRequirementName(entry);
    if (name) devDeps.push(name);
  }

  if (deps.length === 0 && devDeps.length === 0 && !project.name) return null;

  return {
    name: project.name,
    version: project.version,
    description: project.description,
    dependencies: [...new Set(deps)],
    devDependencies: [...new Set(devDeps)],
  };
}

async function tryReadRequirementsTxt(root) {
  const path = join(root, 'requirements.txt');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return null;
  }
  const deps = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('-')) continue; // -r includes, -e editables, etc.
    const name = pythonRequirementName(trimmed);
    if (name) deps.push(name);
  }
  if (deps.length === 0) return null;
  return {
    dependencies: [...new Set(deps)],
    devDependencies: [],
  };
}

// Extract the package name from a Python requirement spec like:
//   "fastapi"  "fastapi>=0.100"  "fastapi[standard]==0.115.0"  "django ; python_version < '3.10'"
function pythonRequirementName(spec) {
  const trimmed = spec.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;
  // Stop at first comparator, environment marker, extras bracket, or whitespace.
  const m = trimmed.match(/^([A-Za-z0-9_][A-Za-z0-9_.-]*)/);
  if (!m) return null;
  return m[1].toLowerCase();
}

// Tiny TOML reader: returns a map of section-name → key/value pairs
// (with array-of-strings values returned as the raw string of the array,
// since we only need to inspect a few of them).
function parseTomlSections(raw) {
  const sections = { '': {} };
  let current = '';
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) {
      i++;
      continue;
    }
    const headerMatch = stripped.match(/^\[\s*([^\]]+?)\s*\]$/);
    if (headerMatch) {
      current = headerMatch[1].trim();
      sections[current] = sections[current] ?? {};
      i++;
      continue;
    }
    const kvMatch = stripped.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!kvMatch) {
      i++;
      continue;
    }
    const key = kvMatch[1];
    let value = kvMatch[2].trim();
    // Handle multi-line arrays: [ ... \n ... \n ]
    if (value.startsWith('[') && !value.includes(']')) {
      let buf = value;
      while (i + 1 < lines.length) {
        i++;
        buf += '\n' + lines[i];
        if (lines[i].includes(']')) break;
      }
      value = buf;
    }
    // Unquote simple scalar string values (leave arrays/inline-tables alone).
    if (
      !value.startsWith('[') &&
      !value.startsWith('{') &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    sections[current][key] = value;
    i++;
  }
  return sections;
}

function parseTomlArrayString(section, key) {
  if (!section) return [];
  const raw = section[key];
  if (!raw || typeof raw !== 'string') return [];
  const m = raw.match(/^\[([\s\S]*)\]$/);
  if (!m) return [];
  const inner = m[1];
  // Split on commas, strip quotes and inline comments
  return inner
    .split(',')
    .map((s) => s.trim().replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((s) => s.replace(/^['"]|['"]$/g, ''));
}

function detectFrameworks(packageMeta) {
  if (!packageMeta) return [];
  const deps = new Set([
    ...(packageMeta.dependencies ?? []),
    ...(packageMeta.devDependencies ?? []),
  ]);
  const found = [];
  for (const [pkg, label] of Object.entries(FRAMEWORK_DEPS)) {
    if (deps.has(pkg)) found.push(label);
  }
  return [...new Set(found)];
}

function detectOrms(packageMeta) {
  if (!packageMeta) return [];
  const deps = new Set([
    ...(packageMeta.dependencies ?? []),
    ...(packageMeta.devDependencies ?? []),
  ]);
  const found = [];
  for (const [pkg, label] of Object.entries(ORM_DEPS)) {
    if (deps.has(pkg)) found.push(label);
  }
  return [...new Set(found)];
}

async function detectRoutes(root, files, frameworks) {
  const routes = [];

  for (const file of files) {
    const next = nextRouteFromFile(file);
    if (next) routes.push(next);
  }

  await detectFrameworkRoutes(root, files, routes);

  if (frameworks.includes('FastAPI') || frameworks.includes('Starlette')) {
    await detectFastapiRoutes(root, files, routes);
  }
  if (frameworks.includes('Flask')) {
    await detectFlaskRoutes(root, files, routes);
  }
  if (frameworks.includes('Django')) {
    await detectDjangoRoutes(root, files, routes);
  }

  return routes;
}

function nextRouteFromFile(file) {
  const m = file.match(/^(?:src\/)?pages\/(.+)\.(?:tsx?|jsx?|mdx?)$/);
  if (m) {
    let path = '/' + m[1].replace(/\/index$/, '').replace(/^index$/, '');
    if (path === '/') path = '/';
    if (path.startsWith('/api/')) {
      return { method: 'ANY', path, file, source: 'next-pages' };
    }
    return { method: 'GET', path, file, source: 'next-pages' };
  }
  const a = file.match(/^(?:src\/)?app\/(.+)\/(page|route)\.(?:tsx?|jsx?)$/);
  if (a) {
    const segments = a[1];
    const kind = a[2];
    const path = '/' + segments;
    if (kind === 'route') {
      return { method: 'ANY', path, file, source: 'next-app-route' };
    }
    return { method: 'GET', path, file, source: 'next-app-page' };
  }
  return null;
}

const TEST_FILE_RE = /(?:^|\/)(?:test|tests|__tests__|spec|specs)\/|\.(?:test|spec)\.[mc]?[jt]sx?$/;

async function detectFrameworkRoutes(root, files, out) {
  // Negative lookbehind for @ avoids matching Python decorators like @app.get("/x").
  const candidates = files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  );
  const RE_SRC = /(?<!@)\b(?:app|router|fastify|koa|server)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi
    .source;
  const perFile = await mapConcurrent(candidates, READ_CONCURRENCY, async (file) => {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      return [];
    }
    if (content.length > 200_000) return [];
    const matches = [];
    const re = new RegExp(RE_SRC, 'gi');
    let m;
    while ((m = re.exec(content)) !== null) {
      matches.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file,
        source: 'http-call',
      });
    }
    return matches;
  });
  for (const matches of perFile) out.push(...matches);
}

async function detectModels(root, files, orms) {
  const models = [];

  if (orms.includes('Prisma')) {
    models.push(...(await parsePrismaSchema(root)));
  }
  if (orms.includes('Mongoose')) {
    models.push(...(await parseMongoose(root, files)));
  }
  if (orms.includes('Drizzle')) {
    models.push(...(await parseDrizzle(root, files)));
  }
  if (orms.includes('SQLAlchemy')) {
    models.push(...(await parseSqlalchemy(root, files)));
  }
  if (orms.includes('Django ORM')) {
    models.push(...(await parseDjangoModels(root, files)));
  }

  return models;
}

async function parsePrismaSchema(root) {
  const path = join(root, 'prisma', 'schema.prisma');
  try {
    await access(path);
  } catch {
    return [];
  }
  const content = await readFile(path, 'utf8');
  const out = [];
  const RE = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
  let m;
  while ((m = RE.exec(content)) !== null) {
    const fields = m[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean)
      .slice(0, 10);
    out.push({
      name: m[1],
      file: 'prisma/schema.prisma',
      fields,
      source: 'prisma',
    });
  }
  return out;
}

async function parseMongoose(root, files) {
  const candidates = files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  );
  const RE_MODEL_SRC = /mongoose\.model\s*\(\s*['"`](\w+)['"`]/g.source;
  const perFile = await mapConcurrent(candidates, READ_CONCURRENCY, async (file) => {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      return [];
    }
    if (!content.includes('mongoose.model')) return [];
    const matches = [];
    const re = new RegExp(RE_MODEL_SRC, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      matches.push({ name: m[1], file, fields: [], source: 'mongoose' });
    }
    return matches;
  });
  return perFile.flat();
}

async function parseDrizzle(root, files) {
  const candidates = files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  );
  const RE_SRC = /(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"`](\w+)['"`]/g.source;
  const perFile = await mapConcurrent(candidates, READ_CONCURRENCY, async (file) => {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      return [];
    }
    const matches = [];
    const re = new RegExp(RE_SRC, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      matches.push({ name: m[1], file, fields: [], source: 'drizzle' });
    }
    return matches;
  });
  return perFile.flat();
}

// ----- Python route detection ---------------------------------------------

function pythonCandidates(files) {
  return files.filter((f) => PY_FILE_RE.test(f) && !PY_TEST_FILE_RE.test(f));
}

async function detectFastapiRoutes(root, files, out) {
  // Matches @app.get("/path"), @router.post("/path"), @api.delete(...)
  const RE_SRC = /@(?:\w+)\.(get|post|put|patch|delete|options|head)\s*\(\s*(?:path\s*=\s*)?['"]([^'"]+)['"]/gi
    .source;
  const QUICK_CHECK = /@\w+\.(get|post|put|patch|delete|options|head)\s*\(/i;
  const perFile = await mapConcurrent(
    pythonCandidates(files),
    READ_CONCURRENCY,
    async (file) => {
      let content;
      try {
        content = await readFile(join(root, file), 'utf8');
      } catch {
        return [];
      }
      if (content.length > 200_000) return [];
      if (!QUICK_CHECK.test(content)) return [];
      const matches = [];
      const re = new RegExp(RE_SRC, 'gi');
      let m;
      while ((m = re.exec(content)) !== null) {
        matches.push({
          method: m[1].toUpperCase(),
          path: m[2],
          file,
          source: 'fastapi',
        });
      }
      return matches;
    },
  );
  for (const matches of perFile) out.push(...matches);
}

async function detectFlaskRoutes(root, files, out) {
  const ROUTE_RE_SRC = /@(?:\w+)\.route\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/g
    .source;
  const SHORT_RE_SRC = /@(?:\w+)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi
    .source;
  const QUICK_CHECK = /@\w+\.(route|get|post|put|patch|delete)\s*\(/i;
  const perFile = await mapConcurrent(
    pythonCandidates(files),
    READ_CONCURRENCY,
    async (file) => {
      let content;
      try {
        content = await readFile(join(root, file), 'utf8');
      } catch {
        return [];
      }
      if (content.length > 200_000) return [];
      if (!QUICK_CHECK.test(content)) return [];
      const matches = [];
      const routeRe = new RegExp(ROUTE_RE_SRC, 'g');
      let m;
      while ((m = routeRe.exec(content)) !== null) {
        const methods = m[2]
          ? m[2]
              .split(',')
              .map((s) => s.trim().replace(/['"]/g, '').toUpperCase())
              .filter(Boolean)
          : ['GET'];
        for (const method of methods) {
          matches.push({ method, path: m[1], file, source: 'flask' });
        }
      }
      const shortRe = new RegExp(SHORT_RE_SRC, 'gi');
      while ((m = shortRe.exec(content)) !== null) {
        matches.push({
          method: m[1].toUpperCase(),
          path: m[2],
          file,
          source: 'flask',
        });
      }
      return matches;
    },
  );
  for (const matches of perFile) out.push(...matches);
}

async function detectDjangoRoutes(root, files, out) {
  // Django defines routes in urls.py via path("foo/", view) or re_path(r"^foo$", view).
  // We pull the literal URL string; the view-name is best-effort.
  const PATH_RE_SRC = /\b(?:re_path|path)\s*\(\s*(?:r?['"])([^'"]+)['"]/g.source;
  const candidates = pythonCandidates(files).filter((f) =>
    /(?:^|\/)urls\.py$/.test(f),
  );
  const perFile = await mapConcurrent(candidates, READ_CONCURRENCY, async (file) => {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      return [];
    }
    if (content.length > 200_000) return [];
    const matches = [];
    const re = new RegExp(PATH_RE_SRC, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      matches.push({
        method: 'ANY',
        path: m[1].startsWith('/') ? m[1] : '/' + m[1],
        file,
        source: 'django',
      });
    }
    return matches;
  });
  for (const matches of perFile) out.push(...matches);
}

// ----- Python model detection ---------------------------------------------

async function parseSqlalchemy(root, files) {
  const CLASS_RE_SRC = /^class\s+(\w+)\s*\(([^)]*)\)\s*:/gm.source;
  const COLUMN_RE_SRC = /^\s{4,}(\w+)\s*(?::\s*[^=]+)?=\s*(?:mapped_column|Column)\s*\(/gm
    .source;
  const TABLE_RE = /__tablename__\s*=\s*['"]([^'"]+)['"]/;
  const QUICK_CHECK = /sqlalchemy|declarative_base|DeclarativeBase|Mapped|db\.Model/;
  const perFile = await mapConcurrent(
    pythonCandidates(files),
    READ_CONCURRENCY,
    async (file) => {
      let content;
      try {
        content = await readFile(join(root, file), 'utf8');
      } catch {
        return [];
      }
      if (content.length > 200_000) return [];
      if (!QUICK_CHECK.test(content)) return [];
      const matches = [];
      const classRe = new RegExp(CLASS_RE_SRC, 'gm');
      let m;
      while ((m = classRe.exec(content)) !== null) {
        const baseList = m[2];
        const isModel = /\bBase\b|\bDeclarativeBase\b|db\.Model|\bModel\b/.test(
          baseList,
        );
        if (!isModel) continue;
        // find the class body (rough — until next top-level "class " or end of file)
        const start = m.index + m[0].length;
        const remainder = content.slice(start);
        const next = remainder.search(/^class\s+\w+\s*\(/m);
        const body = next >= 0 ? remainder.slice(0, next) : remainder;
        const fields = [];
        const localCol = new RegExp(COLUMN_RE_SRC, 'gm');
        let f;
        while ((f = localCol.exec(body)) !== null) {
          if (!fields.includes(f[1])) fields.push(f[1]);
          if (fields.length >= 10) break;
        }
        const tableMatch = body.match(TABLE_RE);
        matches.push({
          name: m[1],
          file,
          fields,
          tableName: tableMatch ? tableMatch[1] : undefined,
          source: 'sqlalchemy',
        });
      }
      return matches;
    },
  );
  return perFile.flat();
}

async function parseDjangoModels(root, files) {
  const CLASS_RE_SRC = /^class\s+(\w+)\s*\(([^)]*)\)\s*:/gm.source;
  const FIELD_RE_SRC = /^\s{4,}(\w+)\s*=\s*models\.\w+/gm.source;
  const candidates = pythonCandidates(files).filter((f) =>
    /(?:^|\/)models(?:\.py|\/)/.test(f),
  );
  const perFile = await mapConcurrent(candidates, READ_CONCURRENCY, async (file) => {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      return [];
    }
    if (content.length > 200_000) return [];
    if (!/models\.Model/.test(content)) return [];
    const matches = [];
    const classRe = new RegExp(CLASS_RE_SRC, 'gm');
    let m;
    while ((m = classRe.exec(content)) !== null) {
      if (!/models\.Model/.test(m[2])) continue;
      const start = m.index + m[0].length;
      const remainder = content.slice(start);
      const next = remainder.search(/^class\s+\w+\s*\(/m);
      const body = next >= 0 ? remainder.slice(0, next) : remainder;
      const fields = [];
      const localField = new RegExp(FIELD_RE_SRC, 'gm');
      let f;
      while ((f = localField.exec(body)) !== null) {
        if (!fields.includes(f[1])) fields.push(f[1]);
        if (fields.length >= 10) break;
      }
      matches.push({
        name: m[1],
        file,
        fields,
        source: 'django',
      });
    }
    return matches;
  });
  return perFile.flat();
}
