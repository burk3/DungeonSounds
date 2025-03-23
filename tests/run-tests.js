// Test Runner for D&D Soundboard Tests
const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Create a new Mocha instance
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 10000, // Increase timeout for tests that involve network requests
});

// Get test directory path
const testDir = __dirname;

// Load all test files from the tests directory
fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .forEach(file => {
    console.log(`Adding test file: ${file}`);
    mocha.addFile(path.join(testDir, file));
  });

console.log('\nRunning D&D Soundboard Tests...\n');

// Run the tests
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});