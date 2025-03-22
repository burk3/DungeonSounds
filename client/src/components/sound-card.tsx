import { Sound } from "@shared/types";
import { formatDistanceToNow } from "date-fns";
import { useWebSocket } from "@/lib/websocket";

interface SoundCardProps {
  sound: Sound;
  isPlaying: boolean;
}

export default function SoundCard({ sound, isPlaying }: SoundCardProps) {
  const { playSound, stopSound } = useWebSocket();
  
  // Format duration
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Format time since upload
  const getTimeAgo = (date: Date | null) => {
    try {
      if (!date) return "recently";
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch (e) {
      return "recently";
    }
  };
  
  const handleClick = () => {
    if (isPlaying) {
      stopSound();
    } else {
      playSound(sound.id);
    }
  };
  
  return (
    <div 
      className={`sound-card bg-gray-700 rounded-lg overflow-hidden shadow hover:shadow-md cursor-pointer p-4 transition-all duration-200 ${isPlaying ? 'playing border-2 border-amber-600' : 'border border-amber-900/30'}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg text-amber-100">{sound.name}</h3>
          <p className="text-sm text-amber-200/70">
            Uploaded by: {sound.uploader || "Anonymous"}
          </p>
        </div>
        <div className="flex space-x-2">
          {/* Duration is not currently available in our Sound type */}
          <span className="inline-block bg-gray-800 text-amber-200 text-xs px-2 py-1 rounded">
            Sound Effect
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center text-sm text-amber-200/60">
          <span className="material-icons text-sm mr-1" aria-hidden="true">schedule</span>
          <span>Added {getTimeAgo(sound.uploadedAt)}</span>
        </div>
        <button 
          className={`${isPlaying ? 'bg-amber-800' : 'bg-amber-600'} text-white rounded-full w-10 h-10 flex items-center justify-center shadow-sm`}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the parent onClick
            handleClick();
          }}
          aria-label={isPlaying ? "Stop sound" : "Play sound"}
        >
          <span className="material-icons" aria-hidden="true">
            {isPlaying ? 'stop' : 'play_arrow'}
          </span>
        </button>
      </div>
    </div>
  );
}
