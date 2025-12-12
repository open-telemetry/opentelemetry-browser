#!/usr/bin/env node
/**
 * Build validation for OpenTelemetry Browser packages
 *
 * Validates:
 * 1. Syntax compliance (es-check on compiled output)
 * 2. Web API baseline (eslint-plugin-baseline-js on compiled output)
 * 3. Package exports & integrity (sourcemaps, imports, publint)
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

function getPackageJson(pkgName) {
  const pkgJsonPath = path.join(PACKAGES_DIR, pkgName, 'package.json');
  return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
}

// Verifies compiled bundles parse as expected ES version
function checkSyntaxCompliance() {
  logSection('1. Syntax Compliance (es-check)');

  const packages = getPackagesWithDist();

  if (packages.length === 0) {
    log('  ⚠ No packages with dist/ found', COLORS.yellow);
    return true;
  }

  const failures = [];

  for (const pkg of packages) {
    const distPath = path.join(PACKAGES_DIR, pkg, 'dist');
    const pattern = `${distPath}/**/*.js`;

    const result = spawnSync(
      'npx',
      ['es-check', 'es2022', pattern, '--module'],
      { encoding: 'utf-8', stdio: 'pipe' },
    );

    if (result.status !== 0) {
      log(`  ✗ ${pkg}`, COLORS.red);
      failures.push(pkg);
    } else {
      log(`  ✓ ${pkg}`, COLORS.green);
    }
  }

  if (failures.length > 0) {
    return false;
  }

  log('\n✓ All syntax checks passed', COLORS.green);
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

function getWorkspaceDependencies(pkgJson) {
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.peerDependencies,
  };

  const workspacePackages = getPackagesWithDist();
  const workspaceNames = workspacePackages.map(
    (pkg) => getPackageJson(pkg).name,
  );

  return workspacePackages.filter(
    (pkg) =>
      workspaceNames.includes(getPackageJson(pkg).name) &&
      Object.keys(allDeps).includes(getPackageJson(pkg).name),
  );
}

function testPackageImports(pkgName) {
  const pkgJson = getPackageJson(pkgName);

  // Skip import test for private packages (internal workspace deps)
  if (pkgJson.private) {
    log(`    ⊘ Skipped (private package)`, COLORS.dim);
    return true;
  }

  const tempDir = fs.mkdtempSync(path.join(ROOT, '.tmp-'));

  try {
    // Pack workspace dependencies first
    const workspaceDeps = getWorkspaceDependencies(pkgJson);
    for (const depPkg of workspaceDeps) {
      const depDir = path.join(PACKAGES_DIR, depPkg);
      execSync('npm pack --quiet', { cwd: depDir, stdio: 'pipe' });
      const depJson = getPackageJson(depPkg);
      const safeName = depJson.name.replace('@', '').replace('/', '-');
      const tarball = fs
        .readdirSync(depDir)
        .find((f) => f.startsWith(safeName) && f.endsWith('.tgz'));
      if (tarball) {
        fs.renameSync(
          path.join(depDir, tarball),
          path.join(tempDir, `${depPkg}.tgz`),
        );
      }
    }

    // Pack the main package
    const pkgDir = path.join(PACKAGES_DIR, pkgName);
    execSync('npm pack --quiet', { cwd: pkgDir, stdio: 'pipe' });
    const safeName = pkgJson.name.replace('@', '').replace('/', '-');
    const tarball = fs
      .readdirSync(pkgDir)
      .find((f) => f.startsWith(safeName) && f.endsWith('.tgz'));

    if (!tarball) {
      throw new Error(`Failed to create tarball for ${pkgName}`);
    }

    fs.renameSync(
      path.join(pkgDir, tarball),
      path.join(tempDir, 'package.tgz'),
    );

    // Create package.json with workspace deps as file references
    const testPkgJson = { type: 'module' };
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(testPkgJson),
    );

    // Install workspace dependencies first
    for (const depPkg of workspaceDeps) {
      execSync(`npm install ./${depPkg}.tgz`, { cwd: tempDir, stdio: 'pipe' });
    }

    // Install the main package
    execSync('npm install ./package.tgz', { cwd: tempDir, stdio: 'pipe' });

    // Test ESM import
    execSync(
      `node --input-type=module -e "import * as pkg from '${pkgJson.name}'; if (!pkg) process.exit(1);"`,
      { cwd: tempDir, stdio: 'pipe' },
    );

    return true;
  } catch (error) {
    log(`    ✗ Import test failed: ${error.message}`, COLORS.red);
    return false;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

    // Test imports
    if (!testPackageImports(pkg)) {
      allPassed = false;
      continue;
    }
    log(`    ✓ ESM imports work`, COLORS.green);
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
  const MAX_SIZE_KB = 50; // Warn if any package exceeds this

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
    const color = gzipKB > MAX_SIZE_KB ? COLORS.yellow : COLORS.green;

    log(
      `  ${pkg}: ${(totalRaw / 1024).toFixed(2)} KB (${gzipKB.toFixed(2)} KB gzipped)`,
      color,
    );
  }

  return true;
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
      ['-r', 'require(', distPath, '--include=*.js'],
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
    { name: 'Syntax compliance', passed: checkSyntaxCompliance() },
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
