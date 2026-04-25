import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan } from '../../src/core/scanner.js';

async function writeFixture(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    const dir = full.slice(0, full.lastIndexOf(/[\\/]/.exec(full)?.[0] ?? '/'));
    await mkdir(dir, { recursive: true });
    await writeFile(full, content, 'utf8');
  }
}

describe('scanner', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-scanner-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('detects framework and ORM from package.json', async () => {
    await writeFixture(dir, {
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: { next: '^14.0.0', '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      }),
      'src/index.ts': '// noop',
    });

    const result = await scan(dir);
    expect(result.frameworks).toContain('Next.js');
    expect(result.orms).toContain('Prisma');
    expect(result.packageMeta.name).toBe('demo');
  });

  it('detects Next.js app-router routes', async () => {
    await writeFixture(dir, {
      'package.json': JSON.stringify({ dependencies: { next: '^14.0.0' } }),
      'app/page.tsx': 'export default function Home() {}',
      'app/dashboard/page.tsx': 'export default function Dash() {}',
      'app/api/users/route.ts': 'export async function GET() {}',
    });

    const result = await scan(dir);
    const paths = result.routes.map((r) => r.path).sort();
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/api/users');
  });

  it('detects Express routes from source', async () => {
    await writeFixture(dir, {
      'package.json': JSON.stringify({ dependencies: { express: '^4.18.0' } }),
      'src/server.js': `
        const app = require('express')();
        app.get('/healthz', (req, res) => res.send('ok'));
        app.post('/api/users', (req, res) => {});
      `,
    });

    const result = await scan(dir);
    const methods = result.routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(methods).toContain('GET /healthz');
    expect(methods).toContain('POST /api/users');
  });

  it('detects React components', async () => {
    await writeFixture(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      'src/components/Button.tsx': 'export const Button = () => null;',
      'src/components/Card.jsx': 'export const Card = () => null;',
    });

    const result = await scan(dir);
    const names = result.components.map((c) => c.name).sort();
    expect(names).toEqual(['Button', 'Card']);
  });

  it('parses Prisma models from schema.prisma', async () => {
    await writeFixture(dir, {
      'package.json': JSON.stringify({
        dependencies: { '@prisma/client': '^5.0.0' },
      }),
      'prisma/schema.prisma': `
generator client {
  provider = "prisma-client-js"
}

model User {
  id    String  @id @default(cuid())
  email String  @unique
  posts Post[]
}

model Post {
  id     String @id @default(cuid())
  title  String
  authorId String
}
      `,
    });

    const result = await scan(dir);
    const names = result.models.map((m) => m.name).sort();
    expect(names).toEqual(['Post', 'User']);
    const user = result.models.find((m) => m.name === 'User');
    expect(user.fields).toContain('id');
    expect(user.fields).toContain('email');
  });

  it('ignores node_modules and .git', async () => {
    await writeFixture(dir, {
      'package.json': '{}',
      'src/app.js': '// real',
      'node_modules/foo/index.js': '// noise',
      '.git/HEAD': 'ref: refs/heads/main',
    });
    const result = await scan(dir);
    expect(result.files).toContain('src/app.js');
    expect(result.files.find((f) => f.startsWith('node_modules/'))).toBeUndefined();
  });
});
