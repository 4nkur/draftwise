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

  it('caps files at maxFiles and sets truncated', async () => {
    const fixture = { 'package.json': '{}' };
    for (let i = 0; i < 10; i++) {
      fixture[`src/file${i}.js`] = `// ${i}`;
    }
    await writeFixture(dir, fixture);

    const result = await scan(dir, { maxFiles: 5 });
    expect(result.files.length).toBe(5);
    expect(result.truncated).toBe(true);
    expect(result.maxFiles).toBe(5);
  });

  it('does not flag truncated when within the cap', async () => {
    await writeFixture(dir, {
      'package.json': '{}',
      'src/a.js': '//',
      'src/b.js': '//',
    });
    const result = await scan(dir, { maxFiles: 100 });
    expect(result.truncated).toBe(false);
    expect(result.files).toHaveLength(2);
  });

  describe('Python support', () => {
    it('detects FastAPI from requirements.txt and parses route decorators', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'fastapi>=0.100\nuvicorn[standard]\n# comment\npydantic\n',
        'app/main.py': `
from fastapi import FastAPI
app = FastAPI()

@app.get("/healthz")
def health():
    return {"ok": True}

@app.post("/users", response_model=User)
async def create_user(user: User):
    pass

@router.delete("/users/{id}")
def delete_user(id: int):
    pass
`,
      });

      const result = await scan(dir);
      expect(result.frameworks).toContain('FastAPI');
      expect(result.packageMeta.dependencies).toContain('fastapi');
      expect(result.packageMeta.dependencies).toContain('uvicorn');
      const routes = result.routes.map((r) => `${r.method} ${r.path}`).sort();
      expect(routes).toContain('GET /healthz');
      expect(routes).toContain('POST /users');
      expect(routes).toContain('DELETE /users/{id}');
    });

    it('detects Flask routes including methods on @app.route', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'flask\n',
        'src/app.py': `
from flask import Flask
app = Flask(__name__)

@app.route("/")
def index():
    return "ok"

@app.route("/items", methods=["GET", "POST"])
def items():
    pass

@app.get("/health")
def health():
    return "ok"
`,
      });

      const result = await scan(dir);
      expect(result.frameworks).toContain('Flask');
      const lines = result.routes.map((r) => `${r.method} ${r.path}`).sort();
      expect(lines).toContain('GET /');
      expect(lines).toContain('GET /items');
      expect(lines).toContain('POST /items');
      expect(lines).toContain('GET /health');
    });

    it('detects Django routes from urls.py and Django ORM from settings', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'django==4.2\npsycopg2-binary\n',
        'project/urls.py': `
from django.urls import path, re_path
from . import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", views.UserList.as_view()),
    re_path(r"^api/users/(?P<pk>\\d+)$", views.UserDetail.as_view()),
]
`,
      });

      const result = await scan(dir);
      expect(result.frameworks).toContain('Django');
      expect(result.orms).toContain('Django ORM');
      const paths = result.routes.map((r) => r.path).sort();
      expect(paths).toContain('/admin/');
      expect(paths).toContain('/api/users/');
      expect(paths.some((p) => p.includes('api/users'))).toBe(true);
    });

    it('parses pyproject.toml PEP 621 dependencies', async () => {
      await writeFixture(dir, {
        'pyproject.toml': `
[project]
name = "demo"
version = "0.1.0"
description = "A demo project"
dependencies = [
  "fastapi>=0.100",
  "sqlalchemy>=2.0",
  "uvicorn",
]

[project.optional-dependencies]
dev = ["pytest", "ruff"]
`,
        'app/main.py': '# noop',
      });

      const result = await scan(dir);
      expect(result.packageMeta.name).toBe('demo');
      expect(result.packageMeta.dependencies).toEqual(
        expect.arrayContaining(['fastapi', 'sqlalchemy', 'uvicorn']),
      );
      expect(result.packageMeta.devDependencies).toEqual(
        expect.arrayContaining(['pytest', 'ruff']),
      );
      expect(result.frameworks).toContain('FastAPI');
      expect(result.orms).toContain('SQLAlchemy');
    });

    it('parses pyproject.toml Poetry dependency tables', async () => {
      await writeFixture(dir, {
        'pyproject.toml': `
[tool.poetry]
name = "demo"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"
flask = "^3.0"
sqlalchemy = "^2.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0"
`,
        'src/app.py': '# noop',
      });

      const result = await scan(dir);
      expect(result.packageMeta.dependencies).toEqual(
        expect.arrayContaining(['flask', 'sqlalchemy']),
      );
      expect(result.packageMeta.dependencies).not.toContain('python');
      expect(result.packageMeta.devDependencies).toContain('pytest');
      expect(result.frameworks).toContain('Flask');
    });

    it('parses SQLAlchemy models with class fields', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'sqlalchemy>=2.0\n',
        'app/models.py': `
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)

class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column()
`,
      });

      const result = await scan(dir);
      const names = result.models.map((m) => m.name).sort();
      expect(names).toContain('User');
      expect(names).toContain('Post');
      const user = result.models.find((m) => m.name === 'User');
      expect(user.fields).toContain('id');
      expect(user.fields).toContain('email');
      expect(user.tableName).toBe('users');
    });

    it('parses Django ORM models from models.py', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'django==4.2\n',
        'blog/models.py': `
from django.db import models

class Post(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField()
    author = models.ForeignKey("auth.User", on_delete=models.CASCADE)

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    body = models.TextField()
`,
      });

      const result = await scan(dir);
      expect(result.orms).toContain('Django ORM');
      const names = result.models.map((m) => m.name).sort();
      expect(names).toEqual(['Comment', 'Post']);
      const post = result.models.find((m) => m.name === 'Post');
      expect(post.fields).toContain('title');
      expect(post.fields).toContain('body');
    });

    it('skips Python test files when detecting routes', async () => {
      await writeFixture(dir, {
        'requirements.txt': 'fastapi\n',
        'app/main.py': `@app.get("/real")
def real(): pass`,
        'tests/test_routes.py': `@app.get("/from-test")
def from_test(): pass`,
        'app/test_helpers.py': `@app.get("/helper-test")
def helper(): pass`,
      });

      const result = await scan(dir);
      const paths = result.routes.map((r) => r.path);
      expect(paths).toContain('/real');
      expect(paths).not.toContain('/from-test');
      expect(paths).not.toContain('/helper-test');
    });
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
