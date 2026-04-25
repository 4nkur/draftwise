import { readdir, readFile, access } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const IGNORE_DIRS = new Set([
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
]);

const CODE_EXTENSIONS = new Set([
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
};

const ORM_DEPS = {
  '@prisma/client': 'Prisma',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  sequelize: 'Sequelize',
  'drizzle-orm': 'Drizzle',
  typeorm: 'TypeORM',
  knex: 'Knex',
};

export const DEFAULT_MAX_FILES = 5000;

export async function scan(root, options = {}) {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const files = [];
  const state = { count: 0, max: maxFiles, truncated: false };
  await walk(root, root, files, state);

  const packageMeta = await readPackageJson(root);
  const frameworks = detectFrameworks(packageMeta);
  const orms = detectOrms(packageMeta);

  const components = files
    .filter((f) => COMPONENT_EXTENSIONS.has(extOf(f)))
    .map((file) => ({ name: baseName(file), file }));

  const routes = await detectRoutes(root, files);
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

async function detectRoutes(root, files) {
  const routes = [];

  for (const file of files) {
    const next = nextRouteFromFile(file);
    if (next) routes.push(next);
  }

  await detectFrameworkRoutes(root, files, routes);

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
  const RE = /\b(?:app|router|fastify|koa|server)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  const candidates = files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  );
  for (const file of candidates) {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      continue;
    }
    if (content.length > 200_000) continue;
    let m;
    while ((m = RE.exec(content)) !== null) {
      out.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file,
        source: 'http-call',
      });
    }
  }
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
  const out = [];
  const RE_MODEL = /mongoose\.model\s*\(\s*['"`](\w+)['"`]/g;
  for (const file of files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  )) {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      continue;
    }
    if (!content.includes('mongoose.model')) continue;
    let m;
    while ((m = RE_MODEL.exec(content)) !== null) {
      out.push({ name: m[1], file, fields: [], source: 'mongoose' });
    }
  }
  return out;
}

async function parseDrizzle(root, files) {
  const out = [];
  const RE = /(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"`](\w+)['"`]/g;
  for (const file of files.filter(
    (f) => /\.(?:[mc]?[jt]s)$/.test(f) && !TEST_FILE_RE.test(f),
  )) {
    let content;
    try {
      content = await readFile(join(root, file), 'utf8');
    } catch {
      continue;
    }
    let m;
    while ((m = RE.exec(content)) !== null) {
      out.push({ name: m[1], file, fields: [], source: 'drizzle' });
    }
  }
  return out;
}
