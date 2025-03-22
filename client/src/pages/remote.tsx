import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sound } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";
import RemoteSoundCard from "@/components/remote-sound-card";
import UploadModal from "@/components/upload-modal";
import Header from "@/components/header";

export default function Remote() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { connected, currentSound } = useWebSocket();
  
  // Fetch all sounds
  const { data: sounds, isLoading, error } = useQuery<Sound[]>({
    queryKey: ["/api/sounds"],
  });
  
  // Use all sounds without filtering by category
  const filteredSounds = sounds || [];
  
  return (
    <div className="w-full min-h-screen bg-[#2A2523] text-amber-100">
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
      
      {/* Status Bar for showing what's playing - always visible */}
      <div className="bg-[#2E241F] text-amber-100 p-3 shadow-md border-b border-amber-800/40 min-h-[72px] flex items-center">
        <div className="container mx-auto flex items-center">
          {currentSound ? (
            <>
              <span className="material-icons text-amber-500 animate-pulse mr-2" aria-hidden="true">graphic_eq</span>
              <div className="overflow-hidden">
                <div className="whitespace-nowrap overflow-ellipsis">
                  <span className="text-sm font-medium">Now Playing: {currentSound.name}</span>
                </div>
              </div>
            </>
          ) : (
            <span className="text-sm text-amber-400/50">No sound playing</span>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        
        {/* Upload Button */}
        <div className="mb-6">
          <button
            className="bg-amber-600 hover:bg-amber-500 text-white py-3 px-6 rounded-lg shadow-md w-full flex items-center justify-center font-medium transition-colors"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <span className="material-icons mr-2" aria-hidden="true">file_upload</span>
            Upload New Sound
          </button>
        </div>
        
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
            <p className="text-sm text-amber-200/50 mt-1">Upload your first sound using the button above</p>
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
