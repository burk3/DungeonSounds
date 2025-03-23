// Authentication Tests
const { expect } = require('chai');
const fetch = require('node-fetch');
const firebase = require('firebase/app');
require('firebase/auth');

// Import Firebase config from the client
const { firebaseConfig } = require('../client/src/lib/firebase');

// Base URL for API tests
const API_BASE = 'http://localhost:5000';

describe('Authentication System', () => {
  let idToken = null;
  let testEmail = process.env.TEST_EMAIL || 'test@example.com';

  // Initialize Firebase for testing
  before(() => {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  });

  it('should have valid Firebase configuration', () => {
    expect(firebaseConfig).to.be.an('object');
    expect(firebaseConfig.apiKey).to.be.a('string').and.not.empty;
    expect(firebaseConfig.authDomain).to.be.a('string').and.not.empty;
  });

  it('should properly validate authentication tokens', async function() {
    // Skip if we don't have a real token for testing
    if (!process.env.TEST_ID_TOKEN) {
      this.skip();
      return;
    }
    
    idToken = process.env.TEST_ID_TOKEN;
    
    // Test the token validation endpoint
    const response = await fetch(`${API_BASE}/api/auth/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ email: testEmail })
    });
    
    // We're testing the token verification logic, not the allowed status
    // The API should respond with 200 if the token is valid, even if access is denied
    expect(response.status).to.be.oneOf([200, 403]);
    
    const data = await response.json();
    expect(data).to.have.property('allowed');
    // May be true or false depending on if the user is in the allowlist
  });

  it('should maintain session state', async function() {
    // Skip if we don't have a real token for testing
    if (!idToken) {
      this.skip();
      return;
    }
    
    // First request to set up session
    const res1 = await fetch(`${API_BASE}/api/auth/update-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });
    
    // Check first response
    expect(res1.status).to.be.oneOf([200, 401]);
    
    // Second request to verify session persists
    const res2 = await fetch(`${API_BASE}/api/auth/update-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({})
    });
    
    // Should get the same status for both requests
    expect(res2.status).to.equal(res1.status);
    
    // If successful responses, check user data consistency
    if (res1.status === 200 && res2.status === 200) {
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      expect(data1.email).to.equal(data2.email);
      expect(data1.isAdmin).to.equal(data2.isAdmin);
    }
  });

  it('should correctly handle token expiration', function() {
    // This is a more complex test that would require mocking Firebase Auth
    // Skipping for now, but this would test handling of expired tokens
    this.skip();
  });
});

if (require.main === module) {
  // Run tests directly if this file is executed directly
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}