// Test runner for the D&D Soundboard test suite
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Get all test files
function getTestFiles() {
  const testDir = path.join(__dirname);
  return fs.readdirSync(testDir)
    .filter(file => file.endsWith('.test.js'))
    .map(file => path.join(testDir, file));
}

// Print test banner
function printBanner() {
  console.log(`\n${colors.cyan}${colors.bold}=======================================`);
  console.log(`  D&D SOUNDBOARD TEST SUITE`);
  console.log(`=======================================${colors.reset}\n`);
}

// Run a single test file
function runTest(testFile) {
  const testName = path.basename(testFile);
  console.log(`${colors.blue}Running ${testName}...${colors.reset}`);
  
  try {
    // Use the Mocha CLI to run the test with proper ES module support
    execSync(`npx mocha ${testFile} --experimental-modules`, { stdio: 'inherit' });
    console.log(`${colors.green}✓ ${testName} passed${colors.reset}\n`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ ${testName} failed${colors.reset}\n`);
    return false;
  }
}

// Print test summary
function printSummary(results) {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`${colors.cyan}${colors.bold}=======================================`);
  console.log(`  TEST SUMMARY`);
  console.log(`=======================================${colors.reset}`);
  console.log(`${colors.white}Total tests: ${totalTests}`);
  console.log(`${colors.green}Passed tests: ${passedTests}`);
  console.log(`${colors.red}Failed tests: ${failedTests}${colors.reset}\n`);
  
  if (failedTests > 0) {
    console.log(`${colors.yellow}Failed tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`${colors.red}  - ${r.name}${colors.reset}`);
    });
    console.log();
  }
}

// Main function
function main() {
  printBanner();
  
  // Check if server is running
  console.log(`${colors.yellow}Note: Make sure your server is running for integration tests${colors.reset}\n`);
  
  const testFiles = getTestFiles();
  const results = [];
  
  // Run each test file
  for (const testFile of testFiles) {
    const testName = path.basename(testFile);
    const passed = runTest(testFile);
    results.push({ name: testName, passed });
  }
  
  // Print summary
  printSummary(results);
  
  // Exit with error code if any tests failed
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// Run the main function
main();

// Export functions for other modules
export {
  getTestFiles,
  runTest
};