import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sound, SoundCategory, SOUND_CATEGORIES } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";
import CategoryTabs from "@/components/category-tabs";
import RemoteSoundCard from "@/components/remote-sound-card";
import UploadModal from "@/components/upload-modal";

export default function Remote() {
  const [activeCategory, setActiveCategory] = useState<SoundCategory>("ambience");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { connected, currentSound } = useWebSocket();
  
  // Fetch all sounds
  const { data: sounds, isLoading, error } = useQuery<Sound[]>({
    queryKey: ["/api/sounds"],
  });
  
  // Filter sounds by category
  const filteredSounds = sounds?.filter(sound => sound.category === activeCategory) || [];
  
  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className="material-icons text-3xl mr-2">equalizer</span>
              <h1 className="font-heading text-2xl font-bold">D&D Soundboard: Remote</h1>
            </div>
            <div className="flex items-center">
              <div className="bg-white/20 rounded-full px-4 py-2 flex items-center">
                <span className="material-icons mr-2">
                  {connected ? "wifi" : "wifi_off"}
                </span>
                <span>{connected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Status Bar for showing what's playing */}
      {currentSound && (
        <div className="bg-gray-900 text-white p-3 shadow-md">
          <div className="container mx-auto flex items-center">
            <span className="material-icons text-secondary animate-pulse mr-2">graphic_eq</span>
            <div className="overflow-hidden">
              <div className="whitespace-nowrap overflow-ellipsis">
                <span className="text-sm font-medium">{currentSound.name}</span>
                <span className="text-xs text-gray-400 ml-2">{currentSound.category}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Sound Categories Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="flex overflow-x-auto">
            <CategoryTabs
              categories={SOUND_CATEGORIES}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              variant="mobile"
            />
          </div>
        </div>
        
        {/* Upload Button */}
        <div className="mb-6">
          <button
            className="bg-accent hover:bg-accent/90 text-white py-3 px-6 rounded-lg shadow-md w-full flex items-center justify-center"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <span className="material-icons mr-2">file_upload</span>
            Upload New Sound
          </button>
        </div>
        
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
            <p className="text-sm text-gray-400 mt-1">Upload your first sound using the button above</p>
          </div>
        )}
        
        {/* Sound Grid */}
        {!isLoading && !error && filteredSounds.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredSounds.map(sound => (
              <RemoteSoundCard 
                key={sound.id} 
                sound={sound}
                isPlaying={currentSound?.id === sound.id}
              />
            ))}
          </div>
        )}
      </main>
      
      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
