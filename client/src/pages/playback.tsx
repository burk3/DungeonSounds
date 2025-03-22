import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Sound } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";
import { useSound } from "@/lib/useSound";
import NowPlaying from "@/components/now-playing";
import SoundCard from "@/components/sound-card";
import Header from "@/components/header";
import { auth } from "@/lib/firebase";

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
    
    const setupAudio = async () => {
      if (currentSound) {
        try {
          // Play the sound through our main player
          play(`/api/audio/${currentSound.filename}`, volume / 100);
          
          // Get the auth token for the tracking audio element
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
          
          // Create a separate audio element to monitor when the sound finishes
          const audio = new Audio();
          audioElementRef.current = audio;
          
          // Set up event listener for when audio finishes
          endedHandler = () => {
            console.log("Sound finished playing naturally");
            stopSound(); // Send stop message to all clients
          };
          
          audio.addEventListener('ended', endedHandler);
          
          // Start playing to track the duration (muted to avoid double playback)
          audio.volume = 0;
          
          // Add auth headers for the fetch request if token is available
          if (token) {
            // Set up fetch interceptor for audio file
            const originalFetch = window.fetch;
            const audioUrl = `/api/audio/${currentSound.filename}`;
            
            window.fetch = function(input, init) {
              if (input && typeof input === 'string' && input.includes(audioUrl)) {
                init = init || {};
                init.headers = {
                  ...init.headers,
                  'Authorization': `Bearer ${token}`
                };
              }
              return originalFetch(input, init);
            };
            
            // Set audio source and attempt to play
            audio.src = audioUrl;
            audio.play().catch(err => console.error("Error tracking audio duration:", err));
            
            // Restore original fetch after a delay
            setTimeout(() => {
              window.fetch = originalFetch;
            }, 3000);
          } else {
            // Fall back to no auth if token not available
            audio.src = `/api/audio/${currentSound.filename}`;
            audio.play().catch(err => console.error("Error tracking audio duration:", err));
          }
        } catch (err) {
          console.error("Error setting up tracking audio:", err);
        }
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
    <div className="w-full min-h-screen bg-[#2A2523]">
      {/* Header with Auth */}
      <Header />
      
      {/* Connection Status */}
      <div className="bg-[#322B28] py-2 border-b border-amber-900">
        <div className="container mx-auto px-4 flex justify-end">
          <div className={`${connected ? 'bg-green-900/40' : 'bg-red-900/40'} rounded-full px-3 py-1 flex items-center text-sm transition-colors`}>
            <span className="material-icons mr-1 text-sm" aria-hidden="true">
              {connected ? "wifi" : "wifi_off"}
            </span>
            <span className="text-amber-200">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </div>
      
      {/* Now Playing Bar */}
      <NowPlaying />
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="bg-[#32291F] rounded-lg shadow-md overflow-hidden border border-amber-800/40">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-amber-300 mb-6">Sound Library</h2>
            
            {/* Loading State */}
            {isLoading && (
              <div className="py-8 text-center">
                <div className="material-icons animate-spin text-4xl text-amber-500 mb-2" aria-hidden="true">cached</div>
                <p className="text-amber-200/80">Loading sounds...</p>
              </div>
            )}
            
            {/* Error State */}
            {error && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-red-500 mb-2" aria-hidden="true">error</div>
                <p className="text-amber-200/80">Failed to load sounds</p>
              </div>
            )}
            
            {/* Empty State */}
            {!isLoading && !error && filteredSounds.length === 0 && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-amber-700/60 mb-2" aria-hidden="true">music_off</div>
                <p className="text-amber-200/80">No sounds available yet</p>
                <p className="text-sm text-amber-200/50 mt-1">Use a Remote device to upload sounds</p>
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
