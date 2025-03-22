import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Create WebSocketContext
const WebSocketContext = createContext(null);

// WebSocketProvider component
// Named this way to avoid circular references when re-exported in websocket.ts
function WebSocketProviderComponent({ children }) {
  const [connected, setConnected] = useState(false);
  const [currentSound, setCurrentSound] = useState(null);
  const [volume, setVolumeState] = useState(75);
  const [isPlayback, setIsPlayback] = useState(false);
  const socketRef = useRef(null);
  const { toast } = useToast();

  // Determine if we're on playback or remote page
  useEffect(() => {
    const path = window.location.pathname;
    setIsPlayback(path.includes("playback"));
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      // Close any existing connection
      if (socketRef.current) {
        socketRef.current.close();
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        // Send connect message with client type
        const clientType = window.location.pathname.includes("playback") 
          ? "playback" 
          : "remote";
        
        socket.send(JSON.stringify({
          type: "connect",
          data: { clientType }
        }));

        toast({
          title: "Connected to soundboard",
          description: `Connected as ${clientType} client`,
        });
      };

      socket.onclose = () => {
        setConnected(false);
        toast({
          title: "Disconnected",
          description: "Lost connection to the soundboard",
          variant: "destructive",
        });
        
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to the soundboard",
          variant: "destructive",
        });
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "nowPlaying":
              setCurrentSound(message.data.sound);
              break;
            case "soundAdded":
              // Invalidate React Query cache to update sound list across all clients
              queryClient.invalidateQueries({ queryKey: ["/api/sounds"] });
              toast({
                title: "New Sound Added",
                description: `"${message.data.sound.name}" has been added`,
              });
              break;
            case "soundDeleted":
              // Invalidate React Query cache to update sound list across all clients
              queryClient.invalidateQueries({ queryKey: ["/api/sounds"] });
              toast({
                title: "Sound Deleted",
                description: "A sound has been removed from the soundboard",
              });
              break;
            case "volume":
              setVolumeState(message.data.volume);
              break;
            case "error":
              toast({
                title: "Error",
                description: message.data.message,
                variant: "destructive",
              });
              break;
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [toast]);

  // Send a message to the WebSocket server
  const sendMessage = useCallback((message) => {
    if (socketRef.current) {
      // Check the readyState
      const readyState = socketRef.current.readyState;
      console.log("WebSocket readyState:", readyState);
      
      if (readyState === WebSocket.OPEN) {
        try {
          const jsonMessage = JSON.stringify(message);
          console.log("Sending message to server:", jsonMessage);
          socketRef.current.send(jsonMessage);
        } catch (error) {
          console.error("Error serializing or sending WebSocket message:", error);
          toast({
            title: "Message Error",
            description: "Failed to send message to server: " + error.message,
            variant: "destructive",
          });
        }
      } else {
        console.error("Cannot send message, socket not in OPEN state:", readyState);
        toast({
          title: "Not Connected",
          description: "Cannot send message: WebSocket not in OPEN state",
          variant: "destructive",
        });
      }
    } else {
      console.error("WebSocket reference is null");
      toast({
        title: "Not Connected",
        description: "Cannot send message: no WebSocket connection",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Helper for playing a sound
  const playSound = useCallback((soundId) => {
    console.log("Attempting to play sound ID:", soundId);
    try {
      const message = {
        type: "play",
        data: { soundId }
      };
      console.log("Sending WebSocket message:", message);
      sendMessage(message);
    } catch (error) {
      console.error("Error in playSound function:", error);
    }
  }, [sendMessage]);

  // Helper for stopping sound
  const stopSound = useCallback(() => {
    sendMessage({
      type: "stop"
    });
  }, [sendMessage]);

  // Helper for adjusting volume
  const setVolume = useCallback((newVolume) => {
    sendMessage({
      type: "volume",
      data: { volume: newVolume }
    });
  }, [sendMessage]);

  const contextValue = {
    connected,
    currentSound,
    volume,
    isPlayback,
    sendMessage,
    playSound,
    stopSound,
    setVolume
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Renamed for exports to avoid circular references
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

// Default export for the provider component
export default WebSocketProviderComponent;