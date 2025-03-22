// Re-exporting from the JSX file
import WebSocketProviderComponent, { useWebSocketHook } from "./websocket.jsx";

// Re-export with different names to avoid circular reference
export const WebSocketProvider = WebSocketProviderComponent;
export const useWebSocket = useWebSocketHook;
