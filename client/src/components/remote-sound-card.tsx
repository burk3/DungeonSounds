import { Sound } from "@shared/types";
import { useWebSocket } from "@/lib/websocket";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface RemoteSoundCardProps {
  sound: Sound;
  isPlaying: boolean;
  isDeleteMode?: boolean;
}

export default function RemoteSoundCard({ sound, isPlaying, isDeleteMode = false }: RemoteSoundCardProps) {
  const { playSound, stopSound } = useWebSocket();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleClick = () => {
    if (!isDeleteMode) {
      if (isPlaying) {
        stopSound();
      } else {
        playSound(sound.id);
      }
    }
  };
  
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      await apiRequest({
        url: `/api/sounds/${sound.id}`,
        method: 'DELETE'
      });
      
      toast({
        title: "Sound Deleted",
        description: `"${sound.name}" has been removed from the soundboard`,
      });
      
      // Invalidate the sounds query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/sounds"] });
      
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting sound:", error);
      toast({
        title: "Error",
        description: "Failed to delete the sound",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div 
      className={`sound-card bg-gray-700 ${isPlaying ? 'border-2 border-amber-600' : 'border border-amber-900/30'} rounded-lg shadow-sm ${isDeleteMode ? '' : 'cursor-pointer'} p-3 flex flex-col relative`}
      onClick={handleClick}
    >
      {/* Delete Overlay (Shown when delete mode is active) */}
      {isDeleteMode && isAdmin && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg z-10">
          {!showDeleteConfirm ? (
            <button
              className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg flex items-center justify-center"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              <span className="material-icons mr-1" aria-hidden="true">delete</span>
              Delete
            </button>
          ) : (
            <div className="p-3 text-center">
              <p className="text-amber-100 mb-3 text-sm">Are you sure you want to delete "{sound.name}"?</p>
              <div className="flex gap-2 justify-center">
                <button
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg flex items-center justify-center"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className="material-icons animate-spin mr-1" aria-hidden="true">cached</span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <span className="material-icons mr-1" aria-hidden="true">delete</span>
                      Yes, Delete
                    </>
                  )}
                </button>
                <button
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Sound Card Content */}
      <div className="mb-2">
        <h3 className="font-medium text-base truncate text-amber-100">{sound.name}</h3>
      </div>
      <button 
        className={`${isPlaying ? 'bg-amber-800 hover:bg-amber-700' : 'bg-amber-600 hover:bg-amber-500'} mt-auto text-white rounded-lg w-full py-2 flex items-center justify-center transition-colors ${isDeleteMode ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering the parent onClick
          handleClick();
        }}
        aria-label={isPlaying ? "Stop sound" : "Play sound"}
        disabled={isDeleteMode}
      >
        <span className="material-icons mr-1" aria-hidden="true">
          {isPlaying ? 'stop' : 'play_arrow'}
        </span>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
    </div>
  );
}
