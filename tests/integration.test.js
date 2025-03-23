// Integration Tests
const { expect } = require('chai');
const fetch = require('node-fetch');
const WebSocket = require('ws');

// Base URL for API tests
const API_BASE = 'http://localhost:5000';
// WebSocket endpoint for tests
const WS_ENDPOINT = 'ws://localhost:5000/ws';

// Helper function to create a WebSocket connection
function createWebSocketConnection(clientType = 'remote') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_ENDPOINT);
    
    const connectionTimeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(connectionTimeout);
      console.log(`WebSocket connection established as ${clientType} client`);
      
      // Send connect message
      const connectMessage = {
        type: 'connect',
        data: { clientType }
      };
      ws.send(JSON.stringify(connectMessage));
      
      // Wait for initial volume message to confirm connection is complete
      ws.once('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'volume') {
            resolve(ws);
          } else {
            reject(new Error(`Unexpected message type: ${message.type}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    ws.on('error', (error) => {
      clearTimeout(connectionTimeout);
      console.error('WebSocket connection error:', error);
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

describe('Integration Tests', function() {
  // Increase timeout for integration tests
  this.timeout(10000);
  
  // Store WebSocket clients
  let remoteWs;
  let playbackWs;
  
  // Set up WebSocket connections
  before(async function() {
    try {
      // Create two WebSocket connections - one for remote control and one for playback
      [remoteWs, playbackWs] = await Promise.all([
        createWebSocketConnection('remote'),
        createWebSocketConnection('playback')
      ]);
      console.log('Successfully created both WebSocket connections');
    } catch (error) {
      console.error('Error setting up WebSocket connections:', error);
      throw error;
    }
  });
  
  // Clean up WebSocket connections
  after(function() {
    // Close WebSocket connections if they exist
    if (remoteWs && remoteWs.readyState === WebSocket.OPEN) {
      remoteWs.close();
    }
    
    if (playbackWs && playbackWs.readyState === WebSocket.OPEN) {
      playbackWs.close();
    }
  });
  
  // Test the entire sound playback flow
  it('should handle the complete sound playback flow', async function() {
    // Skip if WebSocket connections failed
    if (!remoteWs || !playbackWs) {
      this.skip();
      return;
    }
    
    // 1. Get the list of sounds from the API
    const soundsResponse = await fetch(`${API_BASE}/api/sounds`);
    expect(soundsResponse.status).to.equal(200);
    
    const sounds = await soundsResponse.json();
    expect(sounds).to.be.an('array');
    
    // Skip if no sounds are available
    if (sounds.length === 0) {
      console.log('No sounds available for testing');
      this.skip();
      return;
    }
    
    // 2. Select the first sound
    const soundToPlay = sounds[0];
    expect(soundToPlay).to.have.property('id');
    expect(soundToPlay).to.have.property('name');
    
    // 3. Send a play message from the remote client
    const playMessage = {
      type: 'play',
      data: { soundId: soundToPlay.id }
    };
    
    // Set up listeners for nowPlaying messages on both clients
    const playbackPromise = waitForMessage(playbackWs, 'nowPlaying');
    const remotePromise = waitForMessage(remoteWs, 'nowPlaying');
    
    // Send the play message
    remoteWs.send(JSON.stringify(playMessage));
    
    // 4. Verify both clients receive the nowPlaying message
    const [playbackNowPlaying, remoteNowPlaying] = await Promise.all([
      playbackPromise,
      remotePromise
    ]);
    
    // Check playback client message
    expect(playbackNowPlaying.type).to.equal('nowPlaying');
    expect(playbackNowPlaying.data).to.have.property('sound');
    expect(playbackNowPlaying.data.sound).to.be.an('object');
    expect(playbackNowPlaying.data.sound.id).to.equal(soundToPlay.id);
    
    // Check remote client message (should be identical)
    expect(remoteNowPlaying.type).to.equal('nowPlaying');
    expect(remoteNowPlaying.data).to.have.property('sound');
    expect(remoteNowPlaying.data.sound).to.be.an('object');
    expect(remoteNowPlaying.data.sound.id).to.equal(soundToPlay.id);
    
    // 5. Send a stop message from the remote client
    const stopMessage = { type: 'stop' };
    
    // Set up listeners for nowPlaying messages on both clients again
    const playbackStopPromise = waitForMessage(playbackWs, 'nowPlaying');
    const remoteStopPromise = waitForMessage(remoteWs, 'nowPlaying');
    
    // Send the stop message
    remoteWs.send(JSON.stringify(stopMessage));
    
    // 6. Verify both clients receive the nowPlaying message with null sound
    const [playbackStop, remoteStop] = await Promise.all([
      playbackStopPromise,
      remoteStopPromise
    ]);
    
    // Check playback client message
    expect(playbackStop.type).to.equal('nowPlaying');
    expect(playbackStop.data).to.have.property('sound');
    expect(playbackStop.data.sound).to.be.null;
    
    // Check remote client message (should be identical)
    expect(remoteStop.type).to.equal('nowPlaying');
    expect(remoteStop.data).to.have.property('sound');
    expect(remoteStop.data.sound).to.be.null;
  });
  
  // Test volume control flow
  it('should handle the volume control flow', async function() {
    // Skip if WebSocket connections failed
    if (!remoteWs || !playbackWs) {
      this.skip();
      return;
    }
    
    // Get the current volume from the initial connection message
    // (We would need to store this from earlier, here we'll just set a new volume)
    
    // 1. Send a volume message from the remote client
    const newVolume = 50; // Set to 50%
    const volumeMessage = {
      type: 'volume',
      data: { volume: newVolume }
    };
    
    // Set up listener for volume message on playback client
    const playbackVolumePromise = waitForMessage(playbackWs, 'volume');
    
    // Send the volume message
    remoteWs.send(JSON.stringify(volumeMessage));
    
    // 2. Verify the playback client receives the volume message
    const playbackVolume = await playbackVolumePromise;
    
    // Check playback client volume message
    expect(playbackVolume.type).to.equal('volume');
    expect(playbackVolume.data).to.have.property('volume');
    expect(playbackVolume.data.volume).to.equal(newVolume);
    
    // 3. Set volume back to 75% (default)
    const resetVolumeMessage = {
      type: 'volume',
      data: { volume: 75 }
    };
    
    // Send the volume message to reset
    remoteWs.send(JSON.stringify(resetVolumeMessage));
    
    // Wait a short time to ensure the volume message is processed
    await new Promise(resolve => setTimeout(resolve, 500));
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