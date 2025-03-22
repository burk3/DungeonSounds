import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Sound } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";
import { useSound } from "@/lib/useSound";
import NowPlaying from "@/components/now-playing";
import SoundCard from "@/components/sound-card";

export default function Playback() {
  const { connected, currentSound, volume, stopSound, sendMessage } = useWebSocket();
  
  // Initialize audio playback
  const { play, stop, isPlaying } = useSound();
  
  // Fetch all sounds
  const { data: sounds, isLoading, error } = useQuery<Sound[]>({
    queryKey: ["/api/sounds"],
  });
  
  // Use all sounds without filtering by category
  const filteredSounds = sounds || [];
  
  // Reference for audio element to track when it ends
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Play sound when currentSound changes
  useEffect(() => {
    let endedHandler: (() => void) | null = null;
    
    const setupAudio = () => {
      if (currentSound) {
        // Play the sound through our main player
        play(`/api/audio/${currentSound.filename}`, volume / 100);
        
        // Create a separate audio element to monitor when the sound finishes
        const audio = new Audio(`/api/audio/${currentSound.filename}`);
        audioElementRef.current = audio;
        
        // Set up event listener for when audio finishes
        endedHandler = () => {
          console.log("Sound finished playing naturally");
          stopSound(); // Send stop message to all clients
        };
        
        audio.addEventListener('ended', endedHandler);
        
        // Start playing to track the duration (muted to avoid double playback)
        audio.volume = 0;
        audio.play().catch(err => console.error("Error tracking audio duration:", err));
      } else {
        stop();
        cleanupAudio();
      }
    };
    
    const cleanupAudio = () => {
      if (audioElementRef.current) {
        // Remove event listeners
        if (endedHandler) {
          audioElementRef.current.removeEventListener('ended', endedHandler);
        }
        
        // Stop and clean up the audio element
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
    };
    
    setupAudio();
    
    // Cleanup function for when component unmounts or when dependencies change
    return () => {
      cleanupAudio();
    };
  }, [currentSound, volume, play, stop, stopSound]);
  
  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-800 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <span className="material-icons text-3xl mr-3 text-amber-300" aria-hidden="true">equalizer</span>
            <h1 className="font-heading text-2xl font-bold">D&D Soundboard: Playback</h1>
          </div>
          <div className="flex items-center">
            <div className={`${connected ? 'bg-green-600/40' : 'bg-red-600/40'} rounded-full px-4 py-2 flex items-center transition-colors`}>
              <span className="material-icons mr-2" aria-hidden="true">
                {connected ? "wifi" : "wifi_off"}
              </span>
              <span>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Now Playing Bar */}
      <NowPlaying />
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="font-heading text-2xl font-bold text-gray-900 mb-6">Sound Library</h2>
            
            {/* Loading State */}
            {isLoading && (
              <div className="py-8 text-center">
                <div className="material-icons animate-spin text-4xl text-primary mb-2" aria-hidden="true">cached</div>
                <p className="text-gray-500">Loading sounds...</p>
              </div>
            )}
            
            {/* Error State */}
            {error && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-error mb-2" aria-hidden="true">error</div>
                <p className="text-gray-500">Failed to load sounds</p>
              </div>
            )}
            
            {/* Empty State */}
            {!isLoading && !error && filteredSounds.length === 0 && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-gray-400 mb-2" aria-hidden="true">music_off</div>
                <p className="text-gray-500">No sounds available yet</p>
                <p className="text-sm text-gray-400 mt-1">Use a Remote device to upload sounds</p>
              </div>
            )}
            
            {/* Sound Grid */}
            {!isLoading && !error && filteredSounds.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSounds.map(sound => (
                  <SoundCard 
                    key={sound.id} 
                    sound={sound}
                    isPlaying={currentSound?.id === sound.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-5 border-t-2 border-amber-500/30">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-1 text-amber-200">Share this link with your party:</p>
          <p className="font-medium text-lg bg-gray-800/50 py-2 px-4 rounded-md inline-block">{window.location.origin}/remote</p>
        </div>
      </footer>
    </div>
  );
}
