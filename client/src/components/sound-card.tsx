import { Sound } from "@shared/schema";
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
  const getTimeAgo = (date: Date) => {
    try {
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
      className={`sound-card bg-gray-50 rounded-lg overflow-hidden shadow hover:shadow-md cursor-pointer p-4 transition-all duration-200 ${isPlaying ? 'playing border-2 border-secondary' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg">{sound.name}</h3>
          <p className="text-sm text-gray-600">
            Uploaded by: {sound.uploader || "Anonymous"}
          </p>
        </div>
        <div className="flex space-x-2">
          <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded">
            {sound.category}
          </span>
          <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {formatDuration(sound.duration || 0)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center text-sm text-gray-500">
          <span className="material-icons text-sm mr-1">schedule</span>
          <span>Added {getTimeAgo(sound.uploadedAt)}</span>
        </div>
        <button 
          className={`${isPlaying ? 'bg-error' : 'bg-secondary'} text-white rounded-full w-10 h-10 flex items-center justify-center shadow-sm`}
          onClick={handleClick}
        >
          <span className="material-icons">
            {isPlaying ? 'stop' : 'play_arrow'}
          </span>
        </button>
      </div>
    </div>
  );
}
