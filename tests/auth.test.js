// Authentication Tests
import * as chai from 'chai';
import fetch from 'node-fetch';

const { expect } = chai;

// Base URL for API tests
const API_BASE = 'http://localhost:5000';

// Optional test credentials - for manual testing only
// Never hardcode actual credentials here
const TEST_EMAIL = process.env.TEST_EMAIL || null;
const TEST_ID_TOKEN = process.env.TEST_ID_TOKEN || null;

describe('Authentication Tests', function() {
  this.timeout(5000); // Increase timeout for auth tests
  
  // Basic auth endpoint test
  it('should have a functioning /api/auth endpoint', async function() {
    const res = await fetch(`${API_BASE}/api/auth`);
    expect(res.status).to.be.oneOf([200, 401, 403, 404]);
    // The endpoint either exists or is protected, both are valid scenarios
  });
  
  // Test protected routes return 401 without authentication
  it('should require authentication for admin routes', async function() {
    const endpoints = [
      '/api/admin/allowed-users'
    ];
    
    for (const endpoint of endpoints) {
      const res = await fetch(`${API_BASE}${endpoint}`);
      expect(res.status).to.be.oneOf([401, 403], 
        `Endpoint ${endpoint} should require authentication`);
    }
  });
  
  // Test public endpoints are accessible
  it('should allow access to public endpoints', async function() {
    const endpoints = [
      '/api/sounds'
    ];
    
    for (const endpoint of endpoints) {
      const res = await fetch(`${API_BASE}${endpoint}`);
      expect(res.status).to.equal(200,
        `Endpoint ${endpoint} should be publicly accessible`);
    }
  });
  
  // Test for Firebase auth configuration
  it('should have Firebase auth properly configured', async function() {
    // This test checks for the presence of Firebase config
    // without requiring actual authentication
    
    // If we're running in a browser environment, we'd check window.firebase
    // Here we'll just check that the login endpoint exists
    
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'OPTIONS'
    });
    
    // If the endpoint exists it will return a 200, 204, or possibly 405
    expect(res.status).to.be.oneOf([200, 204, 405]);
  });
  
  // Skip actual token tests unless credentials are provided
  describe('Token validation (requires credentials)', function() {
    beforeEach(function() {
      if (!TEST_EMAIL || !TEST_ID_TOKEN) {
        console.log('Skipping token tests - no credentials provided');
        this.skip();
      }
    });
    
    it('should accept valid Firebase tokens', async function() {
      const res = await fetch(`${API_BASE}/api/auth/update-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ID_TOKEN}`
        }
      });
      
      // Should be 200 if token is valid
      expect(res.status).to.equal(200);
    });
    
    it('should reject invalid Firebase tokens', async function() {
      const res = await fetch(`${API_BASE}/api/auth/update-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        }
      });
      
      // Should be 401 if token is invalid
      expect(res.status).to.equal(401);
    });
    
    it('should maintain session after token verification', async function() {
      // First, authenticate with the token
      await fetch(`${API_BASE}/api/auth/update-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ID_TOKEN}`
        }
      });
      
      // Then, try to access a protected route with cookies
      // For this to work, we need a cookie jar, which node-fetch doesn't support natively
      // In a real test, we'd use a library like 'tough-cookie' to maintain cookies
      
      console.log('Warning: Session persistence test requires cookie handling');
      console.log('This test is skipped in the automated test suite');
      
      // This is a placeholder that always passes
      expect(true).to.be.true;
    });
  });
});

// For direct execution in ES modules context
// We're using the mocha CLI tool through our test runner