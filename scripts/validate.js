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

function getPackagesWithDist() {
  const packages = fs.readdirSync(PACKAGES_DIR);
  return packages.filter((pkg) => {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');
    return fs.existsSync(distPath);
  });
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

function validateSourcemaps(pkgName) {
  const distPath = path.join(PACKAGES_DIR, pkgName, 'dist');
  const jsFiles = fs.readdirSync(distPath).filter((f) => f.endsWith('.js'));

  for (const jsFile of jsFiles) {
    const mapFile = `${jsFile}.map`;
    const mapPath = path.join(distPath, mapFile);

    if (!fs.existsSync(mapPath)) {
      continue; // Some files may not have sourcemaps
    }

    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      if (!map.sources?.length) {
        log(`    ✗ ${mapFile} has no sources`, COLORS.red);
        return false;
      }
    } catch (error) {
      log(`    ✗ Invalid sourcemap ${mapFile}: ${error.message}`, COLORS.red);
      return false;
    }

    // Check sourcemap reference in JS file
    const jsContent = fs.readFileSync(path.join(distPath, jsFile), 'utf-8');
    if (!jsContent.includes('sourceMappingURL=')) {
      log(`    ✗ ${jsFile} missing sourcemap reference`, COLORS.red);
      return false;
    }
  }

  return true;
}

function checkPackageExports() {
  logSection('3. Package Exports & Integrity');

  const packages = getPackagesWithDist();
  let allPassed = true;

  for (const pkg of packages) {
    log(`  ${pkg}:`, COLORS.blue);

    // Validate sourcemaps
    if (!validateSourcemaps(pkg)) {
      allPassed = false;
      continue;
    }
    log(`    ✓ Sourcemaps valid`, COLORS.green);
  }

  // Run publint on each package
  log(`\n  Running publint...`, COLORS.blue);
  for (const pkg of packages) {
    const pkgDir = path.join(PACKAGES_DIR, pkg);
    try {
      execSync('npx publint', { cwd: pkgDir, stdio: 'pipe' });
      log(`    ✓ ${pkg}`, COLORS.green);
    } catch (error) {
      log(`    ⚠ ${pkg} (warnings)`, COLORS.yellow);
      if (error.stdout) {
        log(`      ${error.stdout.toString().trim()}`, COLORS.dim);
      }
    }
  }

  if (allPassed) {
    log('\n✓ Package exports valid', COLORS.green);
  }
  return allPassed;
}

function checkBundleSize() {
  logSection('4. Bundle Size');

  const packages = getPackagesWithDist();
  const MAX_SIZE_KB = 6;
  let allPassed = true;

  for (const pkg of packages) {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');
    const jsFiles = fs
      .readdirSync(distPath)
      .filter((f) => f.endsWith('.js') && !f.endsWith('.map'));

    let totalRaw = 0;
    let totalGzip = 0;

    for (const jsFile of jsFiles) {
      const content = fs.readFileSync(path.join(distPath, jsFile));
      totalRaw += content.length;
      totalGzip += zlib.gzipSync(content).length;
    }

    const gzipKB = totalGzip / 1024;
    const passed = gzipKB <= MAX_SIZE_KB;
    if (!passed) {
      allPassed = false;
    }

    log(
      `  ${passed ? '✓' : '✗'} ${pkg}: ${(totalRaw / 1024).toFixed(2)} KB (${gzipKB.toFixed(2)} KB gzipped)`,
      passed ? COLORS.green : COLORS.red,
    );
  }

  return allPassed;
}

// Validates ESM files don't use require() (causes runtime errors)
function validateModuleIntegrity() {
  logSection('5. Module Integrity');

  const packages = getPackagesWithDist();
  let allPassed = true;

  for (const pkg of packages) {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');

    const result = spawnSync(
      'grep',
      ['-rE', '\\brequire\\s*\\(', distPath, '--include=*.js'],
      {
        encoding: 'utf-8',
        stdio: 'pipe',
      },
    );

    if (result.status === 0) {
      // Found matches - this is bad
      log(`  ✗ ${pkg}: Found require() in ESM files`, COLORS.red);
      if (result.stdout) {
        log(`    ${result.stdout.trim().slice(0, 200)}`, COLORS.dim);
      }
      allPassed = false;
    } else {
      log(`  ✓ ${pkg}: No require() in ESM files`, COLORS.green);
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

  const results = [
    { name: 'API compliance', passed: checkAPICompliance() },
    { name: 'Web API baseline', passed: checkBaselineAPIs() },
    { name: 'Package exports', passed: checkPackageExports() },
    { name: 'Bundle size', passed: checkBundleSize() },
    { name: 'Module integrity', passed: validateModuleIntegrity() },
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
