// Re-exporting from the JSX file
import React from 'react';
import WebSocketProviderComponent, { useWebSocket as useWebSocketOriginal } from "./websocket.jsx";

// Re-export with proper types
export const WebSocketProvider: React.FC<{children: React.ReactNode}> = WebSocketProviderComponent;
export const useWebSocket: () => {
  connected: boolean;
  currentSound: any;
  volume: number;
  isPlayback: boolean;
  sendMessage: (message: any) => void;
  playSound: (soundId: number) => void;
  stopSound: () => void;
  setVolume: (volume: number) => void;
} = useWebSocketOriginal;

// Add default export to fix TypeScript error
export default WebSocketProvider;
