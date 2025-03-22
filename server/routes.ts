import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { 
  WSMessage, 
  PlaySoundMessage, 
  VolumeMessage, 
  ConnectMessage,
  NowPlayingMessage,
  SoundCategory,
  SOUND_CATEGORIES,
  insertSoundSchema
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Create a temporary storage for uploads using multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only audio files
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/x-wav'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = {
    playback: new Set<WebSocket>(),
    remote: new Set<WebSocket>()
  };
  
  // Track currently playing sound
  let currentlyPlaying: number | null = null;
  let currentVolume: number = 75; // Default volume (0-100)
  
  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    let clientType: 'playback' | 'remote' | null = null;
    
    ws.on('message', async (message: string) => {
      try {
        const parsedMessage = JSON.parse(message) as WSMessage;
        
        switch (parsedMessage.type) {
          case 'connect': {
            const { clientType: type } = parsedMessage.data as ConnectMessage;
            clientType = type;
            
            if (type === 'playback') {
              clients.playback.add(ws);
              console.log('Playback client connected');
              
              // Send current state to new playback client
              if (currentlyPlaying !== null) {
                const sound = await storage.getSound(currentlyPlaying);
                if (sound) {
                  ws.send(JSON.stringify({
                    type: 'nowPlaying',
                    data: { sound }
                  }));
                }
              }
              
              // Send volume info
              ws.send(JSON.stringify({
                type: 'volume',
                data: { volume: currentVolume }
              }));
            } else if (type === 'remote') {
              clients.remote.add(ws);
              console.log('Remote client connected');
              
              // Send currently playing sound to the remote
              if (currentlyPlaying !== null) {
                const sound = await storage.getSound(currentlyPlaying);
                if (sound) {
                  ws.send(JSON.stringify({
                    type: 'nowPlaying',
                    data: { sound }
                  }));
                }
              }
            }
            break;
          }
          
          case 'play': {
            const { soundId } = parsedMessage.data as PlaySoundMessage;
            currentlyPlaying = soundId;
            
            const sound = await storage.getSound(soundId);
            if (!sound) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Sound not found' }
              }));
              return;
            }
            
            const nowPlayingMessage: WSMessage = {
              type: 'nowPlaying',
              data: { sound }
            };
            
            // Send to all playback clients
            clients.playback.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
              }
            });
            
            // Send to all remote clients
            clients.remote.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
              }
            });
            break;
          }
          
          case 'stop': {
            currentlyPlaying = null;
            
            const nowPlayingMessage: WSMessage = {
              type: 'nowPlaying',
              data: { sound: null }
            };
            
            // Send to all playback clients
            clients.playback.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
              }
            });
            
            // Send to all remote clients
            clients.remote.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
              }
            });
            break;
          }
          
          case 'volume': {
            const { volume } = parsedMessage.data as VolumeMessage;
            currentVolume = volume;
            
            // Only send volume updates to playback clients
            clients.playback.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'volume',
                  data: { volume }
                }));
              }
            });
            break;
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
      if (clientType === 'playback') {
        clients.playback.delete(ws);
        console.log('Playback client disconnected');
      } else if (clientType === 'remote') {
        clients.remote.delete(ws);
        console.log('Remote client disconnected');
      }
    });
  });
  
  // API routes
  // Get all sounds
  app.get('/api/sounds', async (req, res) => {
    try {
      const sounds = await storage.getSounds();
      res.json(sounds);
    } catch (err) {
      console.error('Error fetching sounds:', err);
      res.status(500).json({ message: 'Failed to fetch sounds' });
    }
  });
  
  // Get sounds by category
  app.get('/api/sounds/category/:category', async (req, res) => {
    try {
      const category = req.params.category as SoundCategory;
      
      if (!SOUND_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      
      const sounds = await storage.getSoundsByCategory(category);
      res.json(sounds);
    } catch (err) {
      console.error('Error fetching sounds by category:', err);
      res.status(500).json({ message: 'Failed to fetch sounds' });
    }
  });
  
  // Get sound by ID
  app.get('/api/sounds/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid sound ID' });
      }
      
      const sound = await storage.getSound(id);
      
      if (!sound) {
        return res.status(404).json({ message: 'Sound not found' });
      }
      
      res.json(sound);
    } catch (err) {
      console.error('Error fetching sound:', err);
      res.status(500).json({ message: 'Failed to fetch sound' });
    }
  });
  
  // Upload a new sound
  app.post('/api/sounds', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const { name, category, uploader } = req.body;
      
      try {
        // Validate the input
        const parsedData = insertSoundSchema.parse({
          name,
          category,
          uploader: uploader || 'Anonymous',
          filename: '',  // Will be set after file is saved
          duration: 0    // Will be calculated
        });
        
        // Save the file
        const filename = await storage.saveFile(req.file.buffer, req.file.originalname);
        
        // Get file path to calculate duration
        const filePath = storage.getFilePath(filename);
        
        // Calculate audio duration
        const duration = Math.ceil(await getAudioDurationInSeconds(filePath));
        
        // Create the sound entry
        const sound = await storage.createSound({
          ...parsedData,
          filename,
          duration
        });
        
        // Notify all clients about the new sound
        const soundAddedMessage = {
          type: 'soundAdded',
          data: { sound }
        };
        
        // Notify playback clients
        clients.playback.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(soundAddedMessage));
          }
        });
        
        // Notify remote clients
        clients.remote.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(soundAddedMessage));
          }
        });
        
        res.status(201).json(sound);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        throw error;
      }
    } catch (err) {
      console.error('Error uploading sound:', err);
      res.status(500).json({ message: 'Failed to upload sound' });
    }
  });
  
  // Serve audio files
  app.get('/api/audio/:filename', (req, res) => {
    try {
      const filePath = storage.getFilePath(req.params.filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Audio file not found' });
      }
      
      res.sendFile(filePath);
    } catch (err) {
      console.error('Error serving audio file:', err);
      res.status(500).json({ message: 'Failed to serve audio file' });
    }
  });
  
  return httpServer;
}
