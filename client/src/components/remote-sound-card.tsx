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
      className={`sound-card bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer p-3 flex flex-col ${isPlaying ? 'playing border-2 border-secondary' : ''}`}
    >
      <div className="mb-2">
        <h3 className="font-medium text-base truncate">{sound.name}</h3>
        <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded">
          {sound.category}
        </span>
      </div>
      <button 
        className={`${isPlaying ? 'bg-error' : 'bg-secondary'} mt-auto text-white rounded-full w-full py-2 flex items-center justify-center`}
        onClick={handleClick}
      >
        <span className="material-icons mr-1">
          {isPlaying ? 'stop' : 'play_arrow'}
        </span>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
    </div>
  );
}
