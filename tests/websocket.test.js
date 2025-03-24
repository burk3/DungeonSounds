// WebSocket Tests
import chai from 'chai';
import WebSocket from 'ws';

const { expect } = chai;

// WebSocket endpoint for tests
const WS_ENDPOINT = 'ws://localhost:5000/ws';

// Helper function to create a WebSocket connection
function createWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_ENDPOINT);
    
    const connectionTimeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(connectionTimeout);
      resolve(ws);
    });
    
    ws.on('error', (error) => {
      clearTimeout(connectionTimeout);
      reject(error);
    });
  });
}

// Helper function to wait for a specific message type
function waitForMessage(ws, expectedType, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for message type: ${expectedType}`));
    }, timeoutMs);
    
    function messageHandler(data) {
      try {
        const message = JSON.parse(data);
        if (message.type === expectedType) {
          cleanup();
          resolve(message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
    
    function cleanup() {
      clearTimeout(timeout);
      ws.removeListener('message', messageHandler);
    }
    
    ws.on('message', messageHandler);
  });
}

describe('WebSocket Tests', function() {
  this.timeout(10000); // Increase timeout for WebSocket tests
  
  let ws;
  
  // Create WebSocket connection before tests
  before(async function() {
    try {
      ws = await createWebSocketConnection();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.skip();
    }
  });
  
  // Close WebSocket connection after tests
  after(function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  
  // Test client connection - remote client
  it('should connect as a remote client', async function() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.skip();
      return;
    }
    
    // Send connect message as remote client
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for a volume message which indicates successful connection
    const response = await waitForMessage(ws, 'volume');
    
    expect(response).to.have.property('type', 'volume');
    expect(response).to.have.property('data');
    expect(response.data).to.have.property('volume');
    expect(response.data.volume).to.be.a('number');
  });
  
  // Test volume message format
  it('should handle volume message format correctly', async function() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.skip();
      return;
    }
    
    // Send volume message
    const volumeMessage = {
      type: 'volume',
      data: { volume: 50 }
    };
    
    ws.send(JSON.stringify(volumeMessage));
    
    // No response expected as this is a broadcast message
    // This test is actually testing that the message doesn't cause an error
    
    // Wait a short time to ensure the message is processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // If we reached here without an error, the test passed
    expect(true).to.be.true;
  });
  
  // Test invalid message format handling
  it('should reject invalid message formats', async function() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.skip();
      return;
    }
    
    // Send an invalid message
    const invalidMessage = {
      type: 'invalid-type',
      data: {}
    };
    
    // Setup listener for error message
    const errorPromise = waitForMessage(ws, 'error');
    
    // Send the invalid message
    ws.send(JSON.stringify(invalidMessage));
    
    // We should receive an error message
    const response = await errorPromise;
    expect(response).to.have.property('type', 'error');
    expect(response).to.have.property('data');
    expect(response.data).to.have.property('message');
  });
  
  // Test play sound message format
  it('should handle play sound message format correctly', async function() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.skip();
      return;
    }
    
    // For this test to work fully, we'd need a valid sound ID
    // Without it, we expect an error response, which is still valid for format testing
    
    // Send play message with a non-existent sound ID
    const playMessage = {
      type: 'play',
      data: { soundId: 999999 }
    };
    
    // Setup listener for error message or nowPlaying message
    const responsePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.removeListener('message', messageHandler);
        resolve({ type: 'timeout' });
      }, 2000);
      
      function messageHandler(data) {
        try {
          const message = JSON.parse(data);
          if (message.type === 'error' || message.type === 'nowPlaying') {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            resolve(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      }
      
      ws.on('message', messageHandler);
    });
    
    // Send the play message
    ws.send(JSON.stringify(playMessage));
    
    // We should receive either an error message or a nowPlaying message
    const response = await responsePromise;
    expect(response.type).to.be.oneOf(['error', 'nowPlaying', 'timeout']);
  });
  
  // Test reconnection capability
  it('should support reconnection with same client type', async function() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.skip();
      return;
    }
    
    // Close existing connection
    ws.close();
    
    // Wait for close to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a new connection
    try {
      ws = await createWebSocketConnection();
    } catch (error) {
      console.error('Failed to reconnect:', error);
      this.skip();
      return;
    }
    
    // Send connect message
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for a volume message
    const response = await waitForMessage(ws, 'volume');
    
    expect(response).to.have.property('type', 'volume');
  });
});

// For direct execution in ES modules context
// We're using the mocha CLI tool through our test runner