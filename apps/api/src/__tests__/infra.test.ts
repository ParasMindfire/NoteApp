/**
 * Infra tests for AB-1001 (T1 — Root scaffolding)
 *
 * Coverage:
 *   INFRA-S9  → FR-INFRA-10: .env.example tracked; .env gitignored
 *   Structural → FR-INFRA-1:  pnpm-workspace.yaml shape
 *   Structural → FR-INFRA-11: no ^ or ~ in root devDependencies
 *   Structural → FR-INFRA-15: required root scripts present
 *
 * NOTE: Tests run via `vitest` but require `pnpm install` (T4) to execute.
 * Until T4 is complete, validate syntax only by reading this file back.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Monorepo root — resolved via import.meta.url (ESM-safe, Vitest-compatible).
 * File lives at apps/api/src/__tests__/infra.test.ts → 4 levels up = repo root.
 */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

function rootPath(...segments: string[]): string {
  return resolve(ROOT, ...segments);
}

function readRootFile(relativePath: string): string {
  return readFileSync(rootPath(relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// INFRA-S9: .env.example tracked by git; .env gitignored
// Validates FR-INFRA-10
// ---------------------------------------------------------------------------

describe('INFRA-S9: .env.example tracked; .env gitignored (FR-INFRA-10)', () => {
  it('INFRA-S9: .env.example file exists at repo root', () => {
    expect(existsSync(rootPath('.env.example'))).toBe(true);
  });

  it('INFRA-S9: .env.example contains required placeholder keys', () => {
    const content = readRootFile('.env.example');
    expect(content).toMatch(/DATABASE_URL=/);
    expect(content).toMatch(/JWT_SECRET=/);
    expect(content).toMatch(/PORT=/);
  });

  it('INFRA-S9: .env is listed in .gitignore (gitignored)', () => {
    const gitignore = readRootFile('.gitignore');
    // .env must appear as a standalone entry (exact line or pattern)
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it('INFRA-S9: git check-ignore confirms .env is ignored', () => {
    // git check-ignore exits 0 and prints the path when the file is ignored
    let output = '';
    try {
      output = execSync('git check-ignore -v .env', {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // git check-ignore exits 1 when the path is NOT ignored — fail the test
      output = '';
    }
    // Output format: "<file>:<line>:<pattern>\t.env"
    expect(output.trim()).toMatch(/\.env/);
  });

  it('INFRA-S9: .env.example is NOT listed in .gitignore (should be trackable)', () => {
    // The negation rule !.env.example means git WILL track it
    const gitignore = readRootFile('.gitignore');
    expect(gitignore).toMatch(/!\.env\.example/);
  });
});

// ---------------------------------------------------------------------------
// Structural: pnpm-workspace.yaml (FR-INFRA-1)
// ---------------------------------------------------------------------------

describe('Structural: pnpm-workspace.yaml (FR-INFRA-1)', () => {
  it('pnpm-workspace.yaml exists at repo root', () => {
    expect(existsSync(rootPath('pnpm-workspace.yaml'))).toBe(true);
  });

  it('pnpm-workspace.yaml declares apps/* package glob', () => {
    const content = readRootFile('pnpm-workspace.yaml');
    expect(content).toMatch(/apps\/\*/);
  });

  it('pnpm-workspace.yaml declares packages/* package glob', () => {
    const content = readRootFile('pnpm-workspace.yaml');
    expect(content).toMatch(/packages\/\*/);
  });
});

// ---------------------------------------------------------------------------
// Structural: root package.json — private flag (FR-INFRA-1)
// ---------------------------------------------------------------------------

describe('Structural: root package.json — private flag (FR-INFRA-1)', () => {
  it('root package.json has "private": true', () => {
    const pkg = JSON.parse(readRootFile('package.json')) as Record<string, unknown>;
    expect(pkg.private).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural: root package.json — required scripts (FR-INFRA-15)
// ---------------------------------------------------------------------------

describe('Structural: root package.json — required scripts (FR-INFRA-15)', () => {
  const REQUIRED_SCRIPTS = ['build', 'dev', 'test', 'lint', 'typecheck'] as const;

  for (const script of REQUIRED_SCRIPTS) {
    it(`root package.json has script "${script}"`, () => {
      const pkg = JSON.parse(readRootFile('package.json')) as {
        scripts?: Record<string, string>;
      };
      expect(pkg.scripts).toBeDefined();
      expect(typeof pkg.scripts![script]).toBe('string');
      expect(pkg.scripts![script].length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Structural: root package.json — no ^ or ~ in devDependencies (FR-INFRA-11)
// ---------------------------------------------------------------------------

describe('Structural: root package.json — pinned devDependencies (FR-INFRA-11)', () => {
  it('devDependencies contains no ^ (caret) version ranges', () => {
    const pkg = JSON.parse(readRootFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };
    if (!pkg.devDependencies) return; // no devDeps is also fine
    const caretEntries = Object.entries(pkg.devDependencies).filter(([, v]) =>
      v.startsWith('^'),
    );
    expect(caretEntries).toEqual([]);
  });

  it('devDependencies contains no ~ (tilde) version ranges', () => {
    const pkg = JSON.parse(readRootFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };
    if (!pkg.devDependencies) return;
    const tildeEntries = Object.entries(pkg.devDependencies).filter(([, v]) =>
      v.startsWith('~'),
    );
    expect(tildeEntries).toEqual([]);
  });

  it('devDependencies contains no @latest tags', () => {
    const pkg = JSON.parse(readRootFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };
    if (!pkg.devDependencies) return;
    const latestEntries = Object.entries(pkg.devDependencies).filter(([, v]) =>
      v === 'latest',
    );
    expect(latestEntries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T2: TypeScript strict mode (FR-INFRA-2)
// ---------------------------------------------------------------------------

describe('T2: TypeScript strict mode (FR-INFRA-2)', () => {
  // 1. tsconfig.base.json exists
  it('FR-INFRA-2: tsconfig.base.json exists at repo root', () => {
    expect(existsSync(rootPath('tsconfig.base.json'))).toBe(true);
  });

  // 2. tsconfig.base.json has "strict": true
  it('FR-INFRA-2: tsconfig.base.json has strict: true', () => {
    const tsconfig = JSON.parse(readRootFile('tsconfig.base.json')) as {
      compilerOptions?: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions!['strict']).toBe(true);
  });

  // 3. apps/api/tsconfig.json exists
  it('FR-INFRA-2: apps/api/tsconfig.json exists', () => {
    expect(existsSync(rootPath('apps', 'api', 'tsconfig.json'))).toBe(true);
  });

  // 4. apps/api/tsconfig.json extends ../../tsconfig.base.json
  it('FR-INFRA-2: apps/api/tsconfig.json extends ../../tsconfig.base.json', () => {
    const tsconfig = JSON.parse(
      readFileSync(rootPath('apps', 'api', 'tsconfig.json'), 'utf-8'),
    ) as { extends?: string };
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
  });

  // 5. apps/web/tsconfig.json exists
  it('FR-INFRA-2: apps/web/tsconfig.json exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'tsconfig.json'))).toBe(true);
  });

  // 6. apps/web/tsconfig.json extends ../../tsconfig.base.json
  it('FR-INFRA-2: apps/web/tsconfig.json extends ../../tsconfig.base.json', () => {
    const tsconfig = JSON.parse(
      readFileSync(rootPath('apps', 'web', 'tsconfig.json'), 'utf-8'),
    ) as { extends?: string };
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
  });

  // 7. packages/shared/tsconfig.json exists
  it('FR-INFRA-2: packages/shared/tsconfig.json exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'tsconfig.json'))).toBe(true);
  });

  // 8. packages/shared/tsconfig.json extends ../../tsconfig.base.json
  it('FR-INFRA-2: packages/shared/tsconfig.json extends ../../tsconfig.base.json', () => {
    const tsconfig = JSON.parse(
      readFileSync(rootPath('packages', 'shared', 'tsconfig.json'), 'utf-8'),
    ) as { extends?: string };
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
  });

  // 9. Strict mode is reachable via the extends chain for every package tsconfig.
  //    Each package points at tsconfig.base.json which carries strict: true;
  //    none of the package tsconfigs may override strict to false.
  it('FR-INFRA-2: strict mode reachable via extends chain in all package tsconfigs', () => {
    const base = JSON.parse(readRootFile('tsconfig.base.json')) as {
      compilerOptions?: Record<string, unknown>;
    };
    // Confirm the base itself sets strict
    expect(base.compilerOptions!['strict']).toBe(true);

    const packageTsconfigs = [
      'apps/api/tsconfig.json',
      'apps/web/tsconfig.json',
      'packages/shared/tsconfig.json',
    ];

    for (const relativePath of packageTsconfigs) {
      const tsconfig = JSON.parse(readRootFile(relativePath)) as {
        extends?: string;
        compilerOptions?: Record<string, unknown>;
      };
      // extends must point at the base (ensures inheritance)
      expect(tsconfig.extends, `${relativePath} must extend tsconfig.base.json`).toBe(
        '../../tsconfig.base.json',
      );
      // must NOT explicitly override strict to false
      const localStrict = tsconfig.compilerOptions?.['strict'];
      if (localStrict !== undefined) {
        expect(localStrict, `${relativePath} must not set strict: false`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Structural: .gitignore required entries
// ---------------------------------------------------------------------------

describe('Structural: .gitignore required entries', () => {
  it('.gitignore contains node_modules/ entry', () => {
    const content = readRootFile('.gitignore');
    expect(content).toMatch(/node_modules\//);
  });

  it('.gitignore contains .env entry', () => {
    const content = readRootFile('.gitignore');
    expect(content).toMatch(/^\.env$/m);
  });

  it('.gitignore contains dist/ entry', () => {
    const content = readRootFile('.gitignore');
    expect(content).toMatch(/dist\//);
  });
});

// ---------------------------------------------------------------------------
// T3: Package manifests (FR-INFRA-1, FR-INFRA-11, FR-INFRA-14)
// ---------------------------------------------------------------------------

/**
 * Read a package.json relative to the repo root and parse it.
 */
function readPkg(relativePath: string): Record<string, unknown> {
  return JSON.parse(readRootFile(relativePath)) as Record<string, unknown>;
}

/**
 * Collect all [name, version] pairs from dependencies + devDependencies.
 */
function allDepEntries(pkg: Record<string, unknown>): [string, string][] {
  const deps = (pkg['dependencies'] ?? {}) as Record<string, string>;
  const devDeps = (pkg['devDependencies'] ?? {}) as Record<string, string>;
  return [...Object.entries(deps), ...Object.entries(devDeps)];
}

// --- apps/api/package.json ---

describe('T3: apps/api/package.json (FR-INFRA-1, FR-INFRA-11)', () => {
  const PKG_PATH = 'apps/api/package.json';

  it('FR-INFRA-1: apps/api/package.json exists', () => {
    expect(existsSync(rootPath(PKG_PATH))).toBe(true);
  });

  it('FR-INFRA-1: apps/api/package.json has name "@noteapp/api"', () => {
    const pkg = readPkg(PKG_PATH);
    expect(pkg['name']).toBe('@noteapp/api');
  });

  it('FR-INFRA-11: apps/api/package.json has no ^ (caret) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const caretEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('^'));
    expect(caretEntries).toEqual([]);
  });

  it('FR-INFRA-11: apps/api/package.json has no ~ (tilde) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const tildeEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('~'));
    expect(tildeEntries).toEqual([]);
  });

  it('FR-INFRA-11: apps/api/package.json has no @latest in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const latestEntries = allDepEntries(pkg).filter(([, v]) => v === 'latest');
    expect(latestEntries).toEqual([]);
  });
});

// --- apps/web/package.json ---

describe('T3: apps/web/package.json (FR-INFRA-1, FR-INFRA-11)', () => {
  const PKG_PATH = 'apps/web/package.json';

  it('FR-INFRA-1: apps/web/package.json exists', () => {
    expect(existsSync(rootPath(PKG_PATH))).toBe(true);
  });

  it('FR-INFRA-1: apps/web/package.json has name "@noteapp/web"', () => {
    const pkg = readPkg(PKG_PATH);
    expect(pkg['name']).toBe('@noteapp/web');
  });

  it('FR-INFRA-11: apps/web/package.json has no ^ (caret) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const caretEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('^'));
    expect(caretEntries).toEqual([]);
  });

  it('FR-INFRA-11: apps/web/package.json has no ~ (tilde) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const tildeEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('~'));
    expect(tildeEntries).toEqual([]);
  });

  it('FR-INFRA-11: apps/web/package.json has no @latest in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const latestEntries = allDepEntries(pkg).filter(([, v]) => v === 'latest');
    expect(latestEntries).toEqual([]);
  });
});

// --- packages/shared/package.json ---

describe('T3: packages/shared/package.json (FR-INFRA-1, FR-INFRA-11, FR-INFRA-14)', () => {
  const PKG_PATH = 'packages/shared/package.json';

  it('FR-INFRA-1: packages/shared/package.json exists', () => {
    expect(existsSync(rootPath(PKG_PATH))).toBe(true);
  });

  it('FR-INFRA-1: packages/shared/package.json has name "@noteapp/shared"', () => {
    const pkg = readPkg(PKG_PATH);
    expect(pkg['name']).toBe('@noteapp/shared');
  });

  it('FR-INFRA-11: packages/shared/package.json has no ^ (caret) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const caretEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('^'));
    expect(caretEntries).toEqual([]);
  });

  it('FR-INFRA-11: packages/shared/package.json has no ~ (tilde) in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const tildeEntries = allDepEntries(pkg).filter(([, v]) => v.startsWith('~'));
    expect(tildeEntries).toEqual([]);
  });

  it('FR-INFRA-11: packages/shared/package.json has no @latest in any dependency version', () => {
    const pkg = readPkg(PKG_PATH);
    const latestEntries = allDepEntries(pkg).filter(([, v]) => v === 'latest');
    expect(latestEntries).toEqual([]);
  });

  it('FR-INFRA-14: packages/shared/package.json exports "." with import, require, and types fields', () => {
    const pkg = readPkg(PKG_PATH);
    const exports = pkg['exports'] as Record<string, unknown> | undefined;
    expect(exports, 'exports field must be present').toBeDefined();
    const dotExport = exports!['.'] as Record<string, unknown> | undefined;
    expect(dotExport, 'exports["."] must be present').toBeDefined();
    expect(typeof dotExport!['import'], 'import field must be a string').toBe('string');
    expect(typeof dotExport!['require'], 'require field must be a string').toBe('string');
    expect(typeof dotExport!['types'], 'types field must be a string').toBe('string');
  });
});

// ---------------------------------------------------------------------------
// T4: pnpm install + Husky (FR-INFRA-1, FR-INFRA-6)
// ---------------------------------------------------------------------------

describe('T4: pnpm install --frozen-lockfile (FR-INFRA-1)', () => {
  it('FR-INFRA-1: pnpm-lock.yaml exists at repo root', () => {
    expect(existsSync(rootPath('pnpm-lock.yaml'))).toBe(true);
  });

  it('INFRA-S1: pnpm install --frozen-lockfile exits 0', () => {
    try {
      execSync('pnpm install --frozen-lockfile', { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      throw new Error(
        `pnpm install --frozen-lockfile failed: ${String(err)}`,
      );
    }
  }, 60000);
});

describe('T4: Husky pre-commit hook (FR-INFRA-6)', () => {
  it('FR-INFRA-6: .husky directory exists', () => {
    expect(existsSync(rootPath('.husky'))).toBe(true);
  });

  it('FR-INFRA-6: .husky/pre-commit file exists', () => {
    expect(existsSync(rootPath('.husky', 'pre-commit'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T5: packages/shared tsup build (FR-INFRA-14, INFRA-S8)
// ---------------------------------------------------------------------------

describe('T5: packages/shared tsup build outputs (FR-INFRA-14)', () => {
  it('INFRA-S8: packages/shared/dist/index.js (ESM bundle) exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'dist', 'index.js'))).toBe(true);
  });

  it('INFRA-S8: packages/shared/dist/index.cjs (CJS bundle) exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'dist', 'index.cjs'))).toBe(true);
  });

  it('INFRA-S8: packages/shared/dist/index.d.ts (type declarations) exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'dist', 'index.d.ts'))).toBe(true);
  });

  it('INFRA-S8: packages/shared/package.json exports map has "types" before "import" and "require" under "."', () => {
    const pkg = readPkg('packages/shared/package.json');
    const exports = pkg['exports'] as Record<string, unknown> | undefined;
    expect(exports, 'exports field must be present').toBeDefined();
    const dotExport = exports!['.'] as Record<string, unknown> | undefined;
    expect(dotExport, 'exports["."] must be present').toBeDefined();
    const keys = Object.keys(dotExport!);
    const typesIdx = keys.indexOf('types');
    const importIdx = keys.indexOf('import');
    const requireIdx = keys.indexOf('require');
    expect(typesIdx, '"types" key must be present in exports["."]').toBeGreaterThanOrEqual(0);
    expect(importIdx, '"import" key must be present in exports["."]').toBeGreaterThanOrEqual(0);
    expect(requireIdx, '"require" key must be present in exports["."]').toBeGreaterThanOrEqual(0);
    expect(typesIdx, '"types" must appear before "import" in exports["."]').toBeLessThan(importIdx);
    expect(typesIdx, '"types" must appear before "require" in exports["."]').toBeLessThan(requireIdx);
  });

  it('INFRA-S8: packages/shared/tsup.config.ts exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'tsup.config.ts'))).toBe(true);
  });

  it('INFRA-S8: packages/shared/src/index.ts (source entry) exists', () => {
    expect(existsSync(rootPath('packages', 'shared', 'src', 'index.ts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T6: apps/api skeleton (FR-INFRA-3)
// ---------------------------------------------------------------------------

describe('T6: apps/api skeleton (FR-INFRA-3)', () => {
  it('T6: apps/api/src/index.ts exists', () => {
    expect(existsSync(rootPath('apps', 'api', 'src', 'index.ts'))).toBe(true);
  });

  it('T6: apps/api/prisma/schema.prisma exists', () => {
    expect(existsSync(rootPath('apps', 'api', 'prisma', 'schema.prisma'))).toBe(true);
  });

  it('T6: apps/api/prisma/schema.prisma contains provider = "postgresql"', () => {
    const content = readFileSync(rootPath('apps', 'api', 'prisma', 'schema.prisma'), 'utf-8');
    expect(content).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it('T6: apps/api/prisma/schema.prisma contains generator client block', () => {
    const content = readFileSync(rootPath('apps', 'api', 'prisma', 'schema.prisma'), 'utf-8');
    expect(content).toMatch(/generator\s+client/);
  });

  it('T6: apps/api/dist/index.js (build output) exists', () => {
    expect(existsSync(rootPath('apps', 'api', 'dist', 'index.js'))).toBe(true);
  });

  it('T6: apps/api/src/index.ts contains GET /health route', () => {
    const content = readFileSync(rootPath('apps', 'api', 'src', 'index.ts'), 'utf-8');
    expect(content).toMatch(/\/health/);
  });
});

// ---------------------------------------------------------------------------
// T7: apps/web skeleton (FR-INFRA-15)
// ---------------------------------------------------------------------------

describe('T7: apps/web skeleton (FR-INFRA-15)', () => {
  it('T7: apps/web/vite.config.ts exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'vite.config.ts'))).toBe(true);
  });

  it('T7: apps/web/index.html exists and contains <div id="root">', () => {
    const content = readFileSync(rootPath('apps', 'web', 'index.html'), 'utf-8');
    expect(content).toMatch(/<div\s+id="root"/);
  });

  it('T7: apps/web/src/main.tsx exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'src', 'main.tsx'))).toBe(true);
  });

  it('T7: apps/web/src/App.tsx exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'src', 'App.tsx'))).toBe(true);
  });

  it('T7: apps/web/dist/index.html exists (confirms build output)', () => {
    expect(existsSync(rootPath('apps', 'web', 'dist', 'index.html'))).toBe(true);
  });

  it('T7: apps/web/src/App.tsx exports a router', () => {
    const content = readFileSync(rootPath('apps', 'web', 'src', 'App.tsx'), 'utf-8');
    expect(content).toMatch(/createBrowserRouter/);
  });
});

// ---------------------------------------------------------------------------
// T8: Vitest workspace config (FR-INFRA-4)
// ---------------------------------------------------------------------------

describe('T8: Vitest workspace config (FR-INFRA-4)', () => {
  it('T8: vitest.workspace.ts exists at repo root', () => {
    expect(existsSync(rootPath('vitest.workspace.ts'))).toBe(true);
  });

  it('T8: apps/api/vitest.config.ts exists', () => {
    expect(existsSync(rootPath('apps', 'api', 'vitest.config.ts'))).toBe(true);
  });

  it('T8: apps/web/vitest.config.ts exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'vitest.config.ts'))).toBe(true);
  });

  it('T8: apps/web/src/test-setup.ts exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'src', 'test-setup.ts'))).toBe(true);
  });

  it('T8: apps/api/vitest.config.ts sets environment to node', () => {
    const content = readFileSync(rootPath('apps', 'api', 'vitest.config.ts'), 'utf-8');
    expect(content).toMatch(/environment\s*:\s*['"]node['"]/);
  });

  it('T8: apps/web/vitest.config.ts sets environment to jsdom', () => {
    const content = readFileSync(rootPath('apps', 'web', 'vitest.config.ts'), 'utf-8');
    expect(content).toMatch(/environment\s*:\s*['"]jsdom['"]/);
  });

  it('T8: apps/web/vitest.config.ts contains setupFiles', () => {
    const content = readFileSync(rootPath('apps', 'web', 'vitest.config.ts'), 'utf-8');
    expect(content).toMatch(/setupFiles/);
  });

  it('T8: vitest.workspace.ts references apps/api/vitest.config.ts', () => {
    const content = readFileSync(rootPath('vitest.workspace.ts'), 'utf-8');
    expect(content).toMatch(/apps\/api\/vitest\.config\.ts/);
  });

  it('T8: vitest.workspace.ts includes web project configuration', () => {
    const content = readFileSync(rootPath('vitest.workspace.ts'), 'utf-8');
    expect(content).toMatch(/apps.web/);
  });
});

// ---------------------------------------------------------------------------
// T9: Playwright smoke test setup (FR-INFRA-5, INFRA-S3)
// ---------------------------------------------------------------------------

describe('T9: Playwright smoke test (FR-INFRA-5, INFRA-S3)', () => {
  it('INFRA-S3: apps/web/playwright.config.ts exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'playwright.config.ts'))).toBe(true);
  });

  it('INFRA-S3: apps/web/e2e/smoke.e2e.ts exists', () => {
    expect(existsSync(rootPath('apps', 'web', 'e2e', 'smoke.e2e.ts'))).toBe(true);
  });

  it('INFRA-S3: apps/web/e2e/smoke.e2e.ts contains INFRA-S3 scenario ID', () => {
    const content = readFileSync(rootPath('apps', 'web', 'e2e', 'smoke.e2e.ts'), 'utf-8');
    expect(content).toMatch(/INFRA-S3/);
  });

  it('INFRA-S3: apps/web/playwright.config.ts contains baseURL pointing to localhost', () => {
    const content = readFileSync(rootPath('apps', 'web', 'playwright.config.ts'), 'utf-8');
    expect(content).toMatch(/baseURL\s*:\s*['"]http:\/\/localhost/);
  });

  it('INFRA-S3: apps/web/playwright.config.ts references chromium project', () => {
    const content = readFileSync(rootPath('apps', 'web', 'playwright.config.ts'), 'utf-8');
    expect(content).toMatch(/chromium/);
  });
});

// ---------------------------------------------------------------------------
// T10: ESLint + Prettier (FR-INFRA-8, INFRA-S4)
// ---------------------------------------------------------------------------

describe('T10: ESLint + Prettier (FR-INFRA-8, INFRA-S4)', () => {
  it('INFRA-S4: eslint.config.mjs exists at repo root', () => {
    expect(existsSync(rootPath('eslint.config.mjs'))).toBe(true);
  });

  it('INFRA-S4: .prettierrc.json exists at repo root', () => {
    expect(existsSync(rootPath('.prettierrc.json'))).toBe(true);
  });

  it('INFRA-S4: .prettierrc.json has singleQuote: true', () => {
    const config = JSON.parse(readRootFile('.prettierrc.json')) as Record<string, unknown>;
    expect(config['singleQuote']).toBe(true);
  });

  it('INFRA-S4: .prettierrc.json has trailingComma: "all"', () => {
    const config = JSON.parse(readRootFile('.prettierrc.json')) as Record<string, unknown>;
    expect(config['trailingComma']).toBe('all');
  });

  it('INFRA-S4: .prettierrc.json has printWidth: 100', () => {
    const config = JSON.parse(readRootFile('.prettierrc.json')) as Record<string, unknown>;
    expect(config['printWidth']).toBe(100);
  });

  it('INFRA-S4: .prettierrc.json has semi: true', () => {
    const config = JSON.parse(readRootFile('.prettierrc.json')) as Record<string, unknown>;
    expect(config['semi']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T12: Docker Compose + Prisma (FR-INFRA-3, FR-INFRA-13, INFRA-S7)
// ---------------------------------------------------------------------------

describe('T12: Docker Compose + Prisma (FR-INFRA-3, FR-INFRA-13, INFRA-S7)', () => {
  it('T12: docker-compose.yml exists at repo root', () => {
    expect(existsSync(rootPath('docker-compose.yml'))).toBe(true);
  });

  it('T12: docker-compose.yml contains postgres:16 image', () => {
    const content = readRootFile('docker-compose.yml');
    expect(content).toMatch(/postgres:16/);
  });

  it('T12: docker-compose.yml contains volume noteapp_pgdata', () => {
    const content = readRootFile('docker-compose.yml');
    expect(content).toMatch(/noteapp_pgdata/);
  });

  it('T12: docker-compose.yml contains healthcheck pg_isready', () => {
    const content = readRootFile('docker-compose.yml');
    expect(content).toMatch(/pg_isready/);
  });

  it('FR-INFRA-3: apps/api/prisma/schema.prisma contains provider = "postgresql"', () => {
    const content = readFileSync(rootPath('apps', 'api', 'prisma', 'schema.prisma'), 'utf-8');
    expect(content).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it.skipIf(!process.env['DATABASE_URL'])(
    'INFRA-S7: prisma validate exits 0 when DATABASE_URL is set',
    () => {
      execSync('pnpm exec prisma validate', { cwd: rootPath('apps', 'api'), stdio: 'pipe' });
    },
  );
});

// ---------------------------------------------------------------------------
// T11: commitlint config (FR-INFRA-7, INFRA-S6)
// ---------------------------------------------------------------------------

/**
 * Shell to use for execSync on this platform.
 * On Windows, PowerShell echo adds a BOM; use Git Bash echo instead.
 */
const BASH_SHELL =
  process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : true;

describe('T11: commitlint config (FR-INFRA-7, INFRA-S6)', () => {
  it('FR-INFRA-7: commitlint.config.cjs exists at repo root', () => {
    expect(existsSync(rootPath('commitlint.config.cjs'))).toBe(true);
  });

  it('FR-INFRA-7: commitlint.config.cjs extends @commitlint/config-conventional', () => {
    const content = readRootFile('commitlint.config.cjs');
    expect(content).toMatch(/@commitlint\/config-conventional/);
  });

  it('INFRA-S6: feat commit with AB# reference exits 0 (accepted)', () => {
    try {
      execSync('echo "feat(auth): login AB#1001" | pnpm exec commitlint', {
        cwd: ROOT,
        shell: BASH_SHELL,
        stdio: 'pipe',
      });
      // exits 0 — accepted
    } catch {
      throw new Error(
        'Expected "feat(auth): login AB#1001" to be accepted by commitlint (exit 0), but it was blocked.',
      );
    }
  }, 20000);

  it('INFRA-S6: feat commit without AB# reference exits non-zero (blocked)', () => {
    let threw = false;
    try {
      execSync('echo "feat(auth): login" | pnpm exec commitlint', {
        cwd: ROOT,
        shell: BASH_SHELL,
        stdio: 'pipe',
      });
    } catch {
      threw = true;
    }
    expect(threw, 'Expected "feat(auth): login" to be blocked by commitlint (exit non-zero)').toBe(
      true,
    );
  }, 20000);

  it('INFRA-S6: chore commit exits 0 (exempt from AB# requirement)', () => {
    try {
      execSync('echo "chore: cleanup" | pnpm exec commitlint', {
        cwd: ROOT,
        shell: BASH_SHELL,
        stdio: 'pipe',
      });
    } catch {
      throw new Error(
        'Expected "chore: cleanup" to be accepted by commitlint (exit 0), but it was blocked.',
      );
    }
  }, 20000);

  it('INFRA-S6: docs commit exits 0 (exempt from AB# requirement)', () => {
    try {
      execSync('echo "docs: update README" | pnpm exec commitlint', {
        cwd: ROOT,
        shell: BASH_SHELL,
        stdio: 'pipe',
      });
    } catch {
      throw new Error(
        'Expected "docs: update README" to be accepted by commitlint (exit 0), but it was blocked.',
      );
    }
  }, 20000);
});

// ---------------------------------------------------------------------------
// T16: Shell-exec scenarios (FR-INFRA-1, FR-INFRA-8, FR-INFRA-6)
// ---------------------------------------------------------------------------

describe('T16: INFRA-S2 — pnpm build exits 0 (FR-INFRA-1, FR-INFRA-15)', () => {
  it('INFRA-S2: pnpm build exits 0 with 0 errors', () => {
    try {
      execSync('pnpm build', { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      throw new Error(`pnpm build failed: ${String(err)}`);
    }
  }, 120000);
});

describe('T16: INFRA-S4 — pnpm lint exits 0 (FR-INFRA-8)', () => {
  it('INFRA-S4: pnpm lint --max-warnings 0 exits 0', () => {
    try {
      execSync('pnpm lint --max-warnings 0', { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      throw new Error(`pnpm lint --max-warnings 0 failed: ${String(err)}`);
    }
  }, 60000);
});

describe('T16: INFRA-S5 — Husky pre-commit hook content (FR-INFRA-6)', () => {
  it('INFRA-S5: .husky/pre-commit invokes typecheck, lint, and test', () => {
    const hookContent = readFileSync(rootPath('.husky', 'pre-commit'), 'utf-8');
    expect(hookContent, 'pre-commit must call pnpm typecheck').toMatch(/typecheck/);
    expect(hookContent, 'pre-commit must call pnpm lint').toMatch(/lint/);
    expect(hookContent, 'pre-commit must call pnpm test').toMatch(/test/);
  });

  it('INFRA-S5: .husky/commit-msg invokes commitlint', () => {
    const hookContent = readFileSync(rootPath('.husky', 'commit-msg'), 'utf-8');
    expect(hookContent, 'commit-msg must call commitlint').toMatch(/commitlint/);
  });
});

describe('T16: INFRA-S10 — .claude/settings.json MCP keys (FR-INFRA-17)', () => {
  it('INFRA-S10: .claude/settings.json exists and is valid JSON', () => {
    const settingsPath = rootPath('.claude', 'settings.json');
    expect(existsSync(settingsPath), '.claude/settings.json must exist').toBe(true);
    const raw = readFileSync(settingsPath, 'utf-8');
    expect(() => JSON.parse(raw), 'settings.json must be valid JSON').not.toThrow();
  });

  it('INFRA-S10: settings.json contains no literal secret values', () => {
    const raw = readFileSync(rootPath('.claude', 'settings.json'), 'utf-8');
    // Env-var references like ${GITHUB_TOKEN} are fine; literal 40-char hex tokens are not
    const literalTokenPattern = /ghp_[A-Za-z0-9]{36}|[0-9a-f]{40}/;
    expect(
      raw,
      'settings.json must not contain literal GitHub tokens or secrets',
    ).not.toMatch(literalTokenPattern);
  });
});
