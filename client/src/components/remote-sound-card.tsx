import { Sound } from "@shared/schema";
import { useWebSocket } from "@/lib/websocket";

interface RemoteSoundCardProps {
  sound: Sound;
  isPlaying: boolean;
}

export default function RemoteSoundCard({ sound, isPlaying }: RemoteSoundCardProps) {
  const { playSound, stopSound } = useWebSocket();
  
  const handleClick = () => {
    if (isPlaying) {
      stopSound();
    } else {
      playSound(sound.id);
    }
  };
  
  return (
    <div 
      className={`sound-card bg-gray-700 ${isPlaying ? 'border-2 border-amber-600' : 'border border-amber-900/30'} rounded-lg shadow-sm cursor-pointer p-3 flex flex-col`}
      onClick={handleClick}
    >
      <div className="mb-2">
        <h3 className="font-medium text-base truncate text-amber-100">{sound.name}</h3>
      </div>
      <button 
        className={`${isPlaying ? 'bg-amber-800 hover:bg-amber-700' : 'bg-amber-600 hover:bg-amber-500'} mt-auto text-white rounded-lg w-full py-2 flex items-center justify-center transition-colors`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering the parent onClick
          handleClick();
        }}
        aria-label={isPlaying ? "Stop sound" : "Play sound"}
      >
        <span className="material-icons mr-1" aria-hidden="true">
          {isPlaying ? 'stop' : 'play_arrow'}
        </span>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
    </div>
  );
}
