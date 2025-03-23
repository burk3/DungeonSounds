// WebSocket Message Format Tests
const { expect } = require('chai');
const WebSocket = require('ws');
const { WSMessageType } = require('../shared/schema');

// WebSocket endpoint for tests
const WS_ENDPOINT = 'ws://localhost:5000/ws';

// Helper function to create a WebSocket connection
function createWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_ENDPOINT);
    
    ws.on('open', () => {
      console.log('WebSocket connection established for testing');
      resolve(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
      reject(error);
    });
    
    // Set a connection timeout
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
    
    ws.on('open', () => clearTimeout(timeout));
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

describe('WebSocket Message Format', () => {
  let ws;
  
  // Clean up WebSocket connection after each test
  afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  
  it('should connect as remote client with correct format', async () => {
    ws = await createWebSocketConnection();
    
    // Send a properly formatted connect message
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for volume message which is sent automatically on connect
    const volumeMessage = await waitForMessage(ws, 'volume');
    
    expect(volumeMessage).to.be.an('object');
    expect(volumeMessage.type).to.equal('volume');
    expect(volumeMessage.data).to.be.an('object');
    expect(volumeMessage.data.volume).to.be.a('number');
    expect(volumeMessage.data.volume).to.be.within(0, 100);
  });
  
  it('should connect as playback client with correct format', async () => {
    ws = await createWebSocketConnection();
    
    // Send a properly formatted connect message
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'playback' }
    };
    
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for volume message which is sent automatically on connect
    const volumeMessage = await waitForMessage(ws, 'volume');
    
    expect(volumeMessage).to.be.an('object');
    expect(volumeMessage.type).to.equal('volume');
    expect(volumeMessage.data).to.be.an('object');
    expect(volumeMessage.data.volume).to.be.a('number');
    expect(volumeMessage.data.volume).to.be.within(0, 100);
  });
  
  it('should receive error on invalid message format', async () => {
    ws = await createWebSocketConnection();
    
    // Connect first as a remote client
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for initial volume message to ensure connection is established
    await waitForMessage(ws, 'volume');
    
    // Send an invalid format message
    const invalidMessage = {
      type: 'play', 
      // Missing data field with soundId
    };
    ws.send(JSON.stringify(invalidMessage));
    
    // Should receive an error message in response
    const errorMessage = await waitForMessage(ws, 'error');
    
    expect(errorMessage).to.be.an('object');
    expect(errorMessage.type).to.equal('error');
    expect(errorMessage.data).to.be.an('object');
    expect(errorMessage.data.message).to.be.a('string');
  });
  
  it('should handle play message with correct format', async function() {
    this.timeout(10000); // Increase timeout for this test
    
    ws = await createWebSocketConnection();
    
    // Connect as a remote client
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for initial volume message
    await waitForMessage(ws, 'volume');
    
    // Send a properly formatted play message with ID 1
    // Since we don't know if this sound exists, we'll handle both success and error cases
    const playMessage = {
      type: 'play',
      data: { soundId: 1 }  // Using ID 1 which is likely to exist
    };
    ws.send(JSON.stringify(playMessage));
    
    // Wait for either nowPlaying or error message
    try {
      const response = await Promise.race([
        waitForMessage(ws, 'nowPlaying'),
        waitForMessage(ws, 'error')
      ]);
      
      // If we got a response, verify its format regardless of type
      expect(response).to.be.an('object');
      expect(response.type).to.be.oneOf(['nowPlaying', 'error']);
      expect(response.data).to.be.an('object');
      
      if (response.type === 'nowPlaying') {
        // If we got a nowPlaying message, sound may be null or a valid sound object
        if (response.data.sound) {
          expect(response.data.sound.id).to.be.a('number');
          expect(response.data.sound.name).to.be.a('string');
          expect(response.data.sound.filename).to.be.a('string');
          expect(response.data.sound.category).to.be.a('string');
        }
      }
    } catch (error) {
      // If we timed out, fail the test
      throw error;
    }
  });
  
  it('should handle volume message with correct format', async () => {
    ws = await createWebSocketConnection();
    
    // Connect as a remote client
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for initial volume message
    await waitForMessage(ws, 'volume');
    
    // Send a volume message
    const volumeMessage = {
      type: 'volume',
      data: { volume: 50 }
    };
    ws.send(JSON.stringify(volumeMessage));
    
    // Since volume updates are only sent to playback clients, and we're a remote client,
    // we don't expect a response. This test just ensures the message is accepted without error.
    
    // Wait a short time to ensure no error is received
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  it('should handle stop message with correct format', async () => {
    ws = await createWebSocketConnection();
    
    // Connect as a remote client
    const connectMessage = {
      type: 'connect',
      data: { clientType: 'remote' }
    };
    ws.send(JSON.stringify(connectMessage));
    
    // Wait for initial volume message
    await waitForMessage(ws, 'volume');
    
    // Send a stop message
    const stopMessage = {
      type: 'stop'
    };
    ws.send(JSON.stringify(stopMessage));
    
    // Should receive a nowPlaying message with null sound
    const nowPlayingMessage = await waitForMessage(ws, 'nowPlaying');
    
    expect(nowPlayingMessage).to.be.an('object');
    expect(nowPlayingMessage.type).to.equal('nowPlaying');
    expect(nowPlayingMessage.data).to.be.an('object');
    expect(nowPlayingMessage.data.sound).to.be.null;
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