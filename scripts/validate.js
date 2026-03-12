#!/usr/bin/env node
/**
 * Build validation for OpenTelemetry Browser packages
 *
 * Validates:
 * 1. ES2022 API compliance (tsc on source)
 * 2. Web API baseline (eslint-plugin-baseline-js on compiled output)
 * 3. Package exports & integrity (sourcemaps, publint)
 * 4. Bundle size
 * 5. Module integrity (ESM-only, no require())
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log(
    `\n${COLORS.blue}${COLORS.bold}═══ ${title} ═══${COLORS.reset}\n`,
  );
}

function getJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getPackagesWithDist() {
  const packages = fs.readdirSync(PACKAGES_DIR);
  return packages.filter((pkg) => {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');
    return fs.existsSync(distPath);
  });
}

function getDistUnits() {
  const units = [];
  for (const pkg of getPackagesWithDist()) {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');
    const entries = fs.readdirSync(distPath, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const hasTopLevelJs = entries.some(
      (e) => e.isFile() && e.name.endsWith('.js'),
    );

    if (subdirs.length > 0 && !hasTopLevelJs) {
      for (const sub of subdirs) {
        units.push({
          label: `${pkg}/${sub}`,
          distPath: path.join(distPath, sub),
        });
      }
    } else {
      units.push({ label: pkg, distPath });
    }
  }
  return units;
}

// Verifies source only uses ES2022 APIs via tsc
function checkAPICompliance() {
  logSection('1. ES2022 API Compliance (tsc)');

  const result = spawnSync('npm', ['run', 'check:tsc'], {
    encoding: 'utf-8',
    stdio: 'pipe',
    cwd: ROOT,
  });

  if (result.status !== 0) {
    log('  ✗ Non-ES2022 APIs found in source', COLORS.red);
    if (result.stderr) {
      log(result.stderr.trim(), COLORS.dim);
    }
    return false;
  }

  log('  ✓ All source uses ES2022 APIs', COLORS.green);
  return true;
}

// Runs eslint baseline-js on compiled output to catch non-baseline APIs from dependencies
function checkBaselineAPIs() {
  logSection('2. Web API Baseline (eslint)');

  const result = spawnSync('npm', ['run', 'check:eslint:dist'], {
    encoding: 'utf-8',
    stdio: 'pipe',
    cwd: ROOT,
  });

  if (result.status !== 0) {
    log('  ✗ Non-baseline APIs found in compiled output', COLORS.red);
    if (result.stderr) {
      log(result.stderr.trim(), COLORS.dim);
    }
    return false;
  }

  log('  ✓ All APIs are baseline compatible', COLORS.green);
  return true;
}

function validateSourcemaps(distPath) {
  const jsFilePaths = getJsFiles(distPath);
  let mapCount = 0;

  for (const jsFilePath of jsFilePaths) {
    const mapPath = `${jsFilePath}.map`;
    const relPath = path.relative(distPath, jsFilePath);

    if (!fs.existsSync(mapPath)) {
      continue;
    }

    mapCount++;

    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      if (!map.sources?.length) {
        log(`    ✗ ${relPath}.map has no sources`, COLORS.red);
        return false;
      }
    } catch (error) {
      log(
        `    ✗ Invalid sourcemap ${relPath}.map: ${error.message}`,
        COLORS.red,
      );
      return false;
    }

    const jsContent = fs.readFileSync(jsFilePath, 'utf-8');
    if (!jsContent.includes('sourceMappingURL=')) {
      log(`    ✗ ${relPath} missing sourcemap reference`, COLORS.red);
      return false;
    }
  }

  if (jsFilePaths.length > 0 && mapCount === 0) {
    log(
      `    ✗ No sourcemaps found for ${jsFilePaths.length} JS files`,
      COLORS.red,
    );
    return false;
  }

  return true;
}

function checkPackageExports(units) {
  logSection('3. Package Exports & Integrity');
  let allPassed = true;

  for (const { label, distPath } of units) {
    log(`  ${label}:`, COLORS.blue);

    if (!validateSourcemaps(distPath)) {
      allPassed = false;
      continue;
    }
    log(`    ✓ Sourcemaps valid`, COLORS.green);
  }

  // Run publint on each package
  log(`\n  Running publint...`, COLORS.blue);
  for (const pkg of getPackagesWithDist()) {
    const pkgDir = path.join(PACKAGES_DIR, pkg);
    try {
      execSync('npx publint', { cwd: pkgDir, stdio: 'pipe' });
      log(`    ✓ ${pkg}`, COLORS.green);
    } catch (error) {
      log(`    ✗ ${pkg}`, COLORS.red);
      const stdout = error.stdout?.toString().trim();
      const stderr = error.stderr?.toString().trim();
      if (stdout) {
        log(`      ${stdout}`, COLORS.dim);
      }
      if (stderr) {
        log(`      ${stderr}`, COLORS.dim);
      }
      if (!stdout && !stderr) {
        log(`      ${error.message}`, COLORS.dim);
      }
      allPassed = false;
    }
  }

  if (allPassed) {
    log('\n✓ Package exports valid', COLORS.green);
  }
  return allPassed;
}

function checkBundleSize(units) {
  logSection('4. Bundle Size');
  const MIN_SIZE_KB = 1;
  const MAX_SIZE_KB = 4;
  let allPassed = true;

  for (const { label, distPath } of units) {
    const jsFilePaths = getJsFiles(distPath);

    let totalRaw = 0;
    let totalGzip = 0;

    for (const jsFilePath of jsFilePaths) {
      const content = fs.readFileSync(jsFilePath);
      totalRaw += content.length;
      totalGzip += zlib.gzipSync(content).length;
    }

    const rawKB = totalRaw / 1024;
    const gzipKB = totalGzip / 1024;
    const passed = rawKB >= MIN_SIZE_KB && gzipKB <= MAX_SIZE_KB;
    if (!passed) {
      allPassed = false;
    }

    log(
      `  ${passed ? '✓' : '✗'} ${label}: ${rawKB.toFixed(2)} KB (${gzipKB.toFixed(2)} KB gzipped)`,
      passed ? COLORS.green : COLORS.red,
    );
  }

  return allPassed;
}

// Validates ESM files don't use require() (causes runtime errors)
function validateModuleIntegrity(units) {
  logSection('5. Module Integrity');

  const requirePattern = /\brequire\s*\(/;
  let allPassed = true;

  for (const { label, distPath } of units) {
    const jsFilePaths = getJsFiles(distPath);
    const matches = [];

    for (const jsFilePath of jsFilePaths) {
      const content = fs.readFileSync(jsFilePath, 'utf-8');
      if (requirePattern.test(content)) {
        matches.push(path.relative(distPath, jsFilePath));
      }
    }

    if (matches.length > 0) {
      log(`  ✗ ${label}: Found require() in ESM files`, COLORS.red);
      log(`    ${matches.join(', ')}`, COLORS.dim);
      allPassed = false;
    } else {
      log(`  ✓ ${label}: No require() in ESM files`, COLORS.green);
    }
  }

  if (allPassed) {
    log('\n✓ Module integrity validated', COLORS.green);
  }
  return allPassed;
}

function main() {
  logSection('OpenTelemetry Browser Validation');

  const packages = getPackagesWithDist();
  if (packages.length === 0) {
    log('✗ No packages with dist/ found. Run npm run build first.', COLORS.red);
    process.exit(1);
  }

  log(`Found ${packages.length} packages with dist/`, COLORS.dim);

  const units = getDistUnits();

  const results = [
    { name: 'API compliance', passed: checkAPICompliance() },
    { name: 'Web API baseline', passed: checkBaselineAPIs() },
    { name: 'Package exports', passed: checkPackageExports(units) },
    { name: 'Bundle size', passed: checkBundleSize(units) },
    { name: 'Module integrity', passed: validateModuleIntegrity(units) },
  ];

  logSection('Validation Summary');

  results.forEach(({ name, passed }) => {
    log(`  ${passed ? '✓' : '✗'} ${name}`, passed ? COLORS.green : COLORS.red);
  });

  const allPassed = results.every((r) => r.passed);

  log(
    allPassed ? '\n✓ All validations passed!' : '\n✗ Some validations failed',
    allPassed ? COLORS.green + COLORS.bold : COLORS.red + COLORS.bold,
  );

  process.exit(allPassed ? 0 : 1);
}

main();
