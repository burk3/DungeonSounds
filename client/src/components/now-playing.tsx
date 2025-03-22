import { useWebSocket } from "@/lib/websocket";
import { useState, useEffect } from "react";

export default function NowPlaying() {
  const { currentSound, volume, setVolume, stopSound, isPlayback } = useWebSocket();
  const [localVolume, setLocalVolume] = useState(volume);
  
  // Update local volume when remote changes volume
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);
  
  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setLocalVolume(newVolume);
    
    // Debounce volume changes to reduce WebSocket traffic
    const timerId = setTimeout(() => {
      setVolume(newVolume);
    }, 100);
    
    return () => clearTimeout(timerId);
  };
  
  // Ensure we only show this component for playback page and when a sound is playing
  if (!isPlayback) return null;
  
  return (
    <div className="bg-gray-900 text-white p-4 sticky top-0 z-10 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        {currentSound ? (
          <>
            <div className="flex items-center mb-3 md:mb-0">
              <span className="material-icons text-secondary animate-pulse mr-3">graphic_eq</span>
              <div>
                <p className="text-sm uppercase tracking-wider text-gray-400">Now Playing</p>
                <h2 className="text-xl font-medium">{currentSound.name}</h2>
                <p className="text-sm text-gray-300">{currentSound.category}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Volume Control */}
              <div className="flex items-center space-x-2">
                <span className="material-icons">volume_down</span>
                <input 
                  type="range"
                  className="w-32 h-2 bg-gray-700 rounded-lg appearance-none"
                  min="0"
                  max="100"
                  value={localVolume}
                  onChange={handleVolumeChange}
                />
                <span className="material-icons">volume_up</span>
              </div>
              
              {/* Stop Button */}
              <button 
                className="bg-error/90 hover:bg-error text-white rounded-full p-2 flex items-center"
                onClick={stopSound}
              >
                <span className="material-icons">stop</span>
              </button>
            </div>
          </>
        ) : (
          <div className="py-2 text-center w-full">
            <p className="text-gray-400">No sound playing</p>
          </div>
        )}
      </div>
    </div>
  );
}
