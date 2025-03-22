import { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "./firebase";

interface UseSoundReturn {
  play: (url: string, volume?: number) => void;
  stop: () => void;
  isPlaying: boolean;
}

export function useSound(): UseSoundReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);
  
  // Play sound
  const play = useCallback(async (url: string, volume = 1) => {
    try {
      // Stop any currently playing sound
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      
      // Get the authentication token
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      // Create the audio URL with authentication token
      const audioUrl = new URL(url, window.location.origin);
      
      // Create new audio element with authentication
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      
      // Set up audio 
      audioRef.current = audio;
      
      // Set volume (0-1)
      audio.volume = Math.min(Math.max(volume, 0), 1);
      
      // Add event listeners before setting source
      audio.addEventListener('canplaythrough', () => {
        audio.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(err => {
            console.error("Failed to play audio:", err);
            setIsPlaying(false);
          });
      }, { once: true });
      
      // Add load error handler
      audio.addEventListener('error', (e) => {
        console.error("Audio loading error:", e);
        setIsPlaying(false);
      }, { once: true });
      
      // Set the source with credentials after adding event listeners
      if (token) {
        audio.src = url;
        const originalFetch = window.fetch;
        
        // Override fetch temporarily to add auth headers for this audio file
        window.fetch = function(input, init) {
          if (input && typeof input === 'string' && input.includes(url)) {
            init = init || {};
            init.headers = {
              ...init.headers,
              'Authorization': `Bearer ${token}`
            };
          }
          return originalFetch(input, init);
        };
        
        // Set up to restore original fetch after load attempt
        setTimeout(() => {
          window.fetch = originalFetch;
        }, 3000);
      } else {
        audio.src = url;
      }
    } catch (err) {
      console.error("Error setting up audio:", err);
      setIsPlaying(false);
    }
  }, []);
  
  // Stop sound
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setIsPlaying(false);
    }
  }, []);
  
  return { play, stop, isPlaying };
}
