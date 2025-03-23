// Re-exporting from the JSX file
import React from 'react';
import WebSocketProviderComponent, { useWebSocket as useWebSocketOriginal } from "./websocket.jsx";
import { Sound, WSMessage } from "@shared/schema";

// Re-export with proper types
export const WebSocketProvider: React.FC<{children: React.ReactNode}> = WebSocketProviderComponent;
export const useWebSocket: () => {
  connected: boolean;
  currentSound: Sound | null;
  volume: number;
  isPlayback: boolean;
  sendMessage: (message: WSMessage) => void;
  playSound: (soundId: number) => void;
  stopSound: () => void;
  setVolume: (volume: number) => void;
  // No need to add anything here since we're not changing the API
} = useWebSocketOriginal;

// Add default export for compatibility
export default WebSocketProvider;
