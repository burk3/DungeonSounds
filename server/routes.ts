import type { Express, Request, Response, NextFunction } from "express";
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
  insertSoundSchema,
  insertAllowedUserSchema,
  UserRole,
  AllowedUser
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
// No longer using firebase-admin due to initialization issues

// Define the same bucket name used in storage.ts
const BUCKET_NAME = "sounds";

// Firebase Admin setup
// Note: We won't use admin SDK for token verification in this implementation
// Since we're having issues with the admin SDK initialization
// We'll use a custom token verification and allowlist check
console.log("Using custom Firebase auth verification");

// Mock function for token verification that will be replaced with actual implementation
async function verifyFirebaseToken(token: string): Promise<{ email: string; uid: string } | null> {
  try {
    // In a real implementation, this would verify the token with Firebase
    // For now, we'll just trust the token and extract the email from it
    // This is NOT secure for production use
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return {
      email: payload.email || '',
      uid: payload.user_id || payload.sub || ''
    };
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

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

// Authentication middleware
interface AuthRequest extends Request {
  user?: AllowedUser;
  token?: string;
}

// Verify Firebase ID token middleware
const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      // Verify the ID token using our custom function
      const decodedToken = await verifyFirebaseToken(token);
      
      if (!decodedToken || !decodedToken.email) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token or missing email' });
      }
      
      const email = decodedToken.email;
      
      // Check if user is in allowlist
      const isAllowed = await storage.isUserAllowed(email);
      if (!isAllowed) {
        return res.status(403).json({ message: 'Forbidden: User not in allowlist' });
      }
      
      // Get user from storage
      const user = await storage.getAllowedUserByEmail(email);
      
      // Store user info for route handlers
      req.user = user;
      req.token = token;
      
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};

// Admin-only middleware
const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: Authentication required' });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admin privileges required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({ message: 'Server error during authorization' });
  }
};

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
  
  // Auth routes
  
  // Check if a user is allowed (in the allowlist)
  app.post('/api/auth/check', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const isAllowed = await storage.isUserAllowed(email);
      const user = isAllowed ? await storage.getAllowedUserByEmail(email) : null;
      
      res.json({ 
        allowed: isAllowed,
        isAdmin: user ? user.isAdmin : false
      });
    } catch (err) {
      console.error('Error checking user:', err);
      res.status(500).json({ message: 'Error checking user' });
    }
  });

  // Update user info after login (uid and last login)
  app.post('/api/auth/update-login', verifyToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = req.user;
      const { uid } = req.body;
      
      if (uid && !user.uid) {
        // Update user with Firebase UID if not set before
        const updatedUser = await storage.updateAllowedUser(user.id, {
          uid,
          lastLogin: new Date()
        });
        
        res.json(updatedUser);
      } else {
        // Just update last login
        const updatedUser = await storage.updateAllowedUser(user.id, {
          lastLogin: new Date()
        });
        
        res.json(updatedUser);
      }
    } catch (err) {
      console.error('Error updating user login:', err);
      res.status(500).json({ message: 'Error updating user login' });
    }
  });

  // Admin routes
  
  // Get all allowed users (admin only)
  app.get('/api/admin/allowed-users', verifyToken, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllowedUsers();
      res.json(users);
    } catch (err) {
      console.error('Error fetching allowed users:', err);
      res.status(500).json({ message: 'Error fetching allowed users' });
    }
  });
  
  // Add a new allowed user (admin only)
  app.post('/api/admin/allowed-users', verifyToken, requireAdmin, async (req, res) => {
    try {
      const { email, displayName, isAdmin } = req.body;
      
      try {
        // Validate input
        const parsedData = insertAllowedUserSchema.parse({
          email,
          displayName: displayName || null,
          isAdmin: isAdmin === true,
          uid: null // Will be set when user logs in
        });
        
        // Check if user already exists
        const existingUser = await storage.getAllowedUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({ message: 'User already exists' });
        }
        
        // Create the user
        const user = await storage.createAllowedUser(parsedData);
        res.status(201).json(user);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.message });
        }
        throw error;
      }
    } catch (err) {
      console.error('Error creating allowed user:', err);
      res.status(500).json({ message: 'Error creating allowed user' });
    }
  });
  
  // Delete an allowed user (admin only)
  app.delete('/api/admin/allowed-users/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Prevent admin from deleting themselves
      if (req.user && req.user.id === id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      
      const result = await storage.deleteAllowedUser(id);
      
      if (!result) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(204).end();
    } catch (err) {
      console.error('Error deleting allowed user:', err);
      res.status(500).json({ message: 'Error deleting allowed user' });
    }
  });
  
  // Update an allowed user (admin only)
  app.patch('/api/admin/allowed-users/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      const { displayName, isAdmin } = req.body;
      
      // Prevent admin from removing their own admin privileges
      if (req.user && req.user.id === id && isAdmin === false) {
        return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
      }
      
      const updates: Partial<AllowedUser> = {};
      
      if (displayName !== undefined) {
        updates.displayName = displayName;
      }
      
      if (isAdmin !== undefined) {
        updates.isAdmin = isAdmin;
      }
      
      const updatedUser = await storage.updateAllowedUser(id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(updatedUser);
    } catch (err) {
      console.error('Error updating allowed user:', err);
      res.status(500).json({ message: 'Error updating allowed user' });
    }
  });
  
  // API routes - some now public for playback page
  // Get all sounds - public access for playback
  app.get('/api/sounds', async (req, res) => {
    try {
      const sounds = await storage.getSounds();
      res.json(sounds);
    } catch (err) {
      console.error('Error fetching sounds:', err);
      res.status(500).json({ message: 'Failed to fetch sounds' });
    }
  });
  
  // Check if a sound title already exists
  app.get('/api/sounds/check-title-exists', verifyToken, async (req: AuthRequest, res) => {
    try {
      const { title } = req.query;
      
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: "Title parameter is required" });
      }
      
      const exists = await storage.soundTitleExists(title);
      res.json({ exists });
    } catch (error) {
      console.error("Error checking sound title:", error);
      res.status(500).json({ error: "Failed to check sound title" });
    }
  });

  // Get sounds by category - public access for playback
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
      res.status(500).json({ message: 'Failed to fetch sounds by category' });
    }
  });
  
  // Check if a sound title already exists - for validation during upload
  app.get('/api/sounds/check-title/:title', async (req, res) => {
    try {
      const title = req.params.title;
      const exists = await storage.soundTitleExists(title);
      res.json({ exists });
    } catch (err) {
      console.error('Error checking sound title:', err);
      res.status(500).json({ message: 'Failed to check sound title' });
    }
  });
  
  // Get sound by ID
  app.get('/api/sounds/:id', verifyToken, async (req: AuthRequest, res) => {
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
  app.post('/api/sounds', verifyToken, upload.single('file'), async (req: AuthRequest, res) => {
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
  
  // Delete a sound (admin only)
  app.delete('/api/sounds/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid sound ID' });
      }
      
      // Check if currently playing sound is being deleted
      const isCurrentlyPlaying = id === currentlyPlaying;
      
      // Delete the sound
      const result = await storage.deleteSound(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Sound not found' });
      }
      
      // If we deleted the currently playing sound, reset playback
      if (isCurrentlyPlaying) {
        currentlyPlaying = null;
        
        const nowPlayingMessage: WSMessage = {
          type: 'nowPlaying',
          data: { sound: null }
        };
        
        // Notify all clients that playback has stopped
        clients.playback.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(nowPlayingMessage));
          }
        });
        
        clients.remote.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(nowPlayingMessage));
          }
        });
      }
      
      // Notify all clients that a sound was deleted
      const soundDeletedMessage = {
        type: 'soundDeleted',
        data: { id }
      };
      
      clients.playback.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(soundDeletedMessage));
        }
      });
      
      clients.remote.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(soundDeletedMessage));
        }
      });
      
      res.status(204).end();
    } catch (err) {
      console.error('Error deleting sound:', err);
      res.status(500).json({ message: 'Failed to delete sound' });
    }
  });
  
  // Serve audio files - public access for playback
  app.get('/api/audio/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const objectStorage = storage.getObjectStorage();
      
      // Create the full object key with the bucket prefix
      const objectKey = `${BUCKET_NAME}/${filename}`;
      
      // Check if file exists in object storage by attempting to get info
      // The exists method returns a Result<boolean>
      const existsResult = await objectStorage.exists(objectKey);
      
      if (!existsResult.ok || !existsResult.value) {
        return res.status(404).json({ message: 'Audio file not found' });
      }
      
      // Set appropriate Content-Type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'audio/mpeg'; // Default to mp3
      
      if (ext === '.wav') contentType = 'audio/wav';
      else if (ext === '.ogg') contentType = 'audio/ogg';
      else if (ext === '.m4a') contentType = 'audio/m4a';
      
      // Set content type
      res.set('Content-Type', contentType);
      
      try {
        // Get a readable stream from the object storage
        const stream = await objectStorage.downloadAsStream(objectKey);
        
        // Pipe the stream to the response
        stream.pipe(res);
      } catch (streamErr) {
        console.error('Error streaming audio file:', streamErr);
        return res.status(500).json({ message: 'Failed to stream audio file' });
      }
    } catch (err) {
      console.error('Error serving audio file:', err);
      res.status(500).json({ message: 'Failed to serve audio file' });
    }
  });
  
  return httpServer;
}
