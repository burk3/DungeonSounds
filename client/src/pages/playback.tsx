import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Sound, SoundCategory, SOUND_CATEGORIES } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";
import { useSound } from "@/lib/useSound";
import NowPlaying from "@/components/now-playing";
import SoundCard from "@/components/sound-card";
import CategoryTabs from "@/components/category-tabs";

export default function Playback() {
  const [activeCategory, setActiveCategory] = useState<SoundCategory>("ambience");
  const { connected, currentSound, volume } = useWebSocket();
  
  // Initialize audio playback
  const { play, stop } = useSound();
  
  // Fetch all sounds
  const { data: sounds, isLoading, error } = useQuery<Sound[]>({
    queryKey: ["/api/sounds"],
  });
  
  // Filter sounds by category
  const filteredSounds = sounds?.filter(sound => sound.category === activeCategory) || [];
  
  // Play sound when currentSound changes
  useEffect(() => {
    if (currentSound) {
      play(`/api/audio/${currentSound.filename}`, volume / 100);
    } else {
      stop();
    }
  }, [currentSound, volume, play, stop]);
  
  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-800 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <span className="material-icons text-3xl mr-3 text-amber-300">equalizer</span>
            <h1 className="font-heading text-2xl font-bold">D&D Soundboard: Playback</h1>
          </div>
          <div className="flex items-center">
            <div className={`${connected ? 'bg-green-600/40' : 'bg-red-600/40'} rounded-full px-4 py-2 flex items-center transition-colors`}>
              <span className="material-icons mr-2">
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
            
            {/* Sound Categories Tabs */}
            <CategoryTabs
              categories={SOUND_CATEGORIES}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
            />
            
            {/* Loading State */}
            {isLoading && (
              <div className="py-8 text-center">
                <div className="material-icons animate-spin text-4xl text-primary mb-2">cached</div>
                <p className="text-gray-500">Loading sounds...</p>
              </div>
            )}
            
            {/* Error State */}
            {error && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-error mb-2">error</div>
                <p className="text-gray-500">Failed to load sounds</p>
              </div>
            )}
            
            {/* Empty State */}
            {!isLoading && !error && filteredSounds.length === 0 && (
              <div className="py-8 text-center">
                <div className="material-icons text-4xl text-gray-400 mb-2">music_off</div>
                <p className="text-gray-500">No sounds in this category yet</p>
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
