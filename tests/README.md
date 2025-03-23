# D&D Soundboard Test Suite

This test suite is designed to prevent common issues encountered during development of the D&D Soundboard application.

## Test Categories

The test suite focuses on five key areas:

### 1. Authentication Tests (`auth.test.js`)

These tests verify that the authentication system works correctly and persists user sessions reliably:

- Validates Firebase configuration integrity
- Tests token validation logic
- Verifies session persistence between requests
- Handles token expiration (skipped in automatic testing)

**Note:** Some authentication tests require valid Firebase tokens to run completely. Without tokens, they will be skipped automatically.

### 2. WebSocket Message Format Tests (`websocket.test.js`)

These tests verify that WebSocket messages maintain the correct format to prevent client-server communication issues:

- Tests client connection as both remote and playback clients
- Verifies proper format of volume messages
- Tests play sound message handling and format
- Tests stop sound message handling and format
- Verifies error responses on invalid message formats

### 3. Storage/KV Store Tests (`storage.test.js`)

These tests verify the reliability of the database operations:

- Tests user CRUD operations (create, read, update, delete)
- Tests sound CRUD operations
- Verifies error handling for nonexistent resources
- Tests edge cases for incomplete or malformed data

### 4. Zod Schema Validation Tests (`zod-validator.test.js`)

These tests verify that the Zod schemas correctly validate data structures:

- Tests validation of sound objects
- Tests validation of user objects
- Tests validation of WebSocket message formats
- Verifies error handling for invalid data

### 5. Integration Tests (`integration.test.js`)

These tests verify end-to-end workflows across multiple components:

- Tests the complete sound playback flow from remote to playback client
- Tests the volume control flow
- Verifies that WebSocket communication works between multiple clients simultaneously

## Running the Tests

To run all tests:

```bash
node run-tests.js
```

To run an individual test file:

```bash
node tests/auth.test.js
node tests/websocket.test.js
node tests/storage.test.js
node tests/zod-validator.test.js
node tests/integration.test.js
```

## Test Environment Variables

For authentication tests, you may need to set the following environment variables:

- `TEST_EMAIL`: Email address of an authorized user for testing
- `TEST_ID_TOKEN`: A valid Firebase ID token for testing authenticated requests

## Integration with Development Workflow

It's recommended to run these tests:

1. After significant code changes
2. Before deploying new versions
3. When troubleshooting any of the three key issues (auth, WebSocket, or database)

## Adding New Tests

When adding new tests, follow these guidelines:

1. Place test files in the `tests` directory with the `.test.js` naming convention
2. Use descriptive test names that clearly indicate what's being tested
3. Clean up any resources created during testing
4. Avoid dependencies on external services where possible
5. Add appropriate error handling and logging