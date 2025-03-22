import { useState, useEffect, useRef, useCallback } from "react";

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
  const play = useCallback((url: string, volume = 1) => {
    // Stop any currently playing sound
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    
    // Create new audio element
    const audio = new Audio(url);
    audioRef.current = audio;
    
    // Set volume (0-1)
    audio.volume = Math.min(Math.max(volume, 0), 1);
    
    // Play
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.error("Failed to play audio:", err);
      setIsPlaying(false);
    });
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
