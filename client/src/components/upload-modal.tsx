import { useState, ChangeEvent, FormEvent, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SOUND_CATEGORIES } from "@shared/schema";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();
      
      // Create a promise to track the upload
      return new Promise((resolve, reject) => {
        xhr.open("POST", "/api/sounds");
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error("Network error occurred during upload"));
        };
        
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sounds"] });
      toast({
        title: "Sound Uploaded",
        description: `"${name}" has been added to the soundboard`,
      });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadProgress(0);
    }
  });
  
  const resetForm = () => {
    setName("");
    setCategory("");
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select an audio file to upload",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Audio files must be smaller than 10MB",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only MP3, WAV, and OGG audio files are supported",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("file", file);
    
    setIsUploading(true);
    uploadMutation.mutate(formData);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading text-xl font-bold">Upload New Sound</h2>
            <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="sound-name">
                Sound Name
              </label>
              <input 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                id="sound-name" 
                type="text" 
                placeholder="Enter sound name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            {/* Category is simplified, using "effects" by default */}
            <input type="hidden" id="sound-category" value="effects" name="category" />
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="sound-file">
                Sound File
              </label>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-primary"
                onClick={handleFileInputClick}
              >
                <input 
                  type="file" 
                  id="sound-file" 
                  className="hidden" 
                  accept="audio/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  required
                />
                <span className="material-icons text-3xl text-gray-400">upload_file</span>
                <p className="mt-2 text-sm text-gray-500">
                  {file ? `Selected: ${file.name}` : "Click to select or drag and drop an audio file"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Supported formats: MP3, WAV, OGG (Max 10MB)</p>
              </div>
              
              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs mt-1 text-gray-600">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                type="button" 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={onClose}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload Sound"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
