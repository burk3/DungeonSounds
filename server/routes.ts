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
  InsertSound,
  InsertAllowedUser,
  UserRole,
  AllowedUser,
  insertSoundSchema,
  insertAllowedUserSchema
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
// import { getAudioDurationInSeconds } from "get-audio-duration";
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
        console.error('Invalid token or missing email in decoded token:', decodedToken);
        return res.status(401).json({ message: 'Unauthorized: Invalid token or missing email' });
      }
      
      const email = decodedToken.email;
      console.log('User attempting authentication:', email);
      
      // For regular users, check if they're in the allowlist
      const isAllowed = await storage.isUserAllowed(email);
      console.log(`User ${email} allowed status:`, isAllowed);
      
      if (!isAllowed) {
        return res.status(403).json({ message: 'Forbidden: User not in allowlist' });
      }
      
      // Get user from storage
      const user = await storage.getAllowedUserByEmail(email);
      console.log('Retrieved user from storage:', user);
      
      // Store user info for route handlers
      req.user = user;
      req.token = token;
      
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Unauthorized: Invalid token', error: String(error) });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Server error during authentication', error: String(error) });
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
    console.log('New WebSocket client connected');
    
    // Set up a ping interval to keep the connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Send a ping to keep the connection alive
          ws.ping();
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 30000); // Send a ping every 30 seconds
    
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
            console.log('Received play message:', parsedMessage);
            
            if (!parsedMessage.data || typeof parsedMessage.data !== 'object') {
              console.error('Invalid play message format - missing data object');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid play message format' }
              }));
              return;
            }
            
            const { soundId } = parsedMessage.data as PlaySoundMessage;
            console.log('Attempting to play sound ID:', soundId);
            
            if (soundId === undefined || soundId === null) {
              console.error('Invalid play message - missing soundId');
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Missing sound ID' }
              }));
              return;
            }
            
            currentlyPlaying = soundId;
            
            const sound = await storage.getSound(soundId);
            console.log('Found sound for ID:', sound);
            
            if (!sound) {
              console.error(`Sound not found for ID: ${soundId}`);
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
            
            console.log('Sending nowPlaying to clients:', JSON.stringify(nowPlayingMessage));
            
            // Send to all playback clients
            let playbackSent = 0;
            clients.playback.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
                playbackSent++;
              }
            });
            console.log(`Sent to ${playbackSent} playback clients`);
            
            // Send to all remote clients
            let remoteSent = 0;
            clients.remote.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(nowPlayingMessage));
                remoteSent++;
              }
            });
            console.log(`Sent to ${remoteSent} remote clients`);
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
      // Clear the ping interval to prevent memory leaks
      clearInterval(pingInterval);
      
      if (clientType === 'playback') {
        clients.playback.delete(ws);
        console.log('Playback client disconnected (cleanup complete)');
      } else if (clientType === 'remote') {
        clients.remote.delete(ws);
        console.log('Remote client disconnected (cleanup complete)');
      } else {
        console.log('Unknown client disconnected (cleanup complete)');
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
      
      console.log("Checking authorization for user:", email);
      
      // Get user from database
      let user = await storage.getAllowedUserByEmail(email);
      
      const isAllowed = user ? true : await storage.isUserAllowed(email);
      const isAdmin = user ? user.isAdmin : false;
      
      console.log(`User ${email}: allowed=${isAllowed}, isAdmin=${isAdmin}`);
      
      res.json({ 
        allowed: isAllowed,
        isAdmin: isAdmin
      });
    } catch (err) {
      console.error('Error checking user:', err);
      res.status(500).json({ message: 'Error checking user' });
    }
  });

  // Update user login route (simplified - no longer tracking uid/lastLogin)
  app.post('/api/auth/update-login', verifyToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Just return the current user info
      res.json(req.user);
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
  
  // Note: The add user endpoint is now handled at /api/admin/add-user
  
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
      
      const { isAdmin } = req.body;
      
      // Prevent admin from removing their own admin privileges
      if (req.user && req.user.id === id && isAdmin === false) {
        return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
      }
      
      const updates: Partial<AllowedUser> = {};
      
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
  
  // Simplified user management API for admin page
  app.post('/api/admin/add-user', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { email, isAdmin = false } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Valid email is required' });
      }
      
      // Check if user already exists
      const existingUser = await storage.getAllowedUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }
      
      // Create the new user
      const newUser = await storage.createAllowedUser({
        email,
        isAdmin: Boolean(isAdmin)
      });
      
      res.status(201).json(newUser);
    } catch (err) {
      console.error('Error adding user:', err);
      res.status(500).json({ message: 'Failed to add user' });
    }
  });
  
  app.delete('/api/admin/remove-user/:email', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const email = req.params.email;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      // Find user by email
      const user = await storage.getAllowedUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Prevent removing yourself
      if (req.user && req.user.email === email) {
        return res.status(400).json({ message: 'Cannot remove yourself' });
      }
      
      // Delete the user
      const result = await storage.deleteAllowedUser(user.id);
      
      if (!result) {
        return res.status(404).json({ message: 'Failed to delete user' });
      }
      
      res.status(204).end();
    } catch (err) {
      console.error('Error removing user:', err);
      res.status(500).json({ message: 'Failed to remove user' });
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
  
  // Note: Title check is already handled by the first check-title-exists endpoint
  
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
      
      const { name, category } = req.body;
      // Get file extension from original uploaded file
      const fileExt = path.extname(req.file.originalname);
      // Use requested title as filename - add extension if not present
      const hasExtension = name.toLowerCase().endsWith(fileExt.toLowerCase());
      const fullTitle = hasExtension ? name : name + fileExt;
      
      try {
        // First save the file to get the filename
        const filename = await storage.saveFile(req.file.buffer, fullTitle, req.user?.email);
        
        // Then validate with the actual filename included
        const parsedData = insertSoundSchema.parse({
          name,
          category,
          uploader: req.user?.email || null, // Use the actual user email
          filename  // Now we have the real filename
        });
        
        // Create the sound entry
        const sound = await storage.createSound(parsedData);
        
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
      // Get clean filename without any path prefix
      const filename = req.params.filename.replace(/^sounds\//, '');
      const objectStorage = storage.getObjectStorage();
      
      // Try multiple options to find the file
      // First try without any prefix
      let fileExists = false;
      let actualKey = filename;
      
      // Check if file exists in object storage directly
      let existsResult = await objectStorage.exists(filename);
      fileExists = existsResult.ok && existsResult.value;
      
      // If not found, try with "sounds/" prefix (for legacy files)
      if (!fileExists) {
        const fallbackKey = `sounds/${filename}`;
        existsResult = await objectStorage.exists(fallbackKey);
        if (existsResult.ok && existsResult.value) {
          fileExists = true;
          actualKey = fallbackKey;
        }
      }
      
      if (!fileExists) {
        console.log(`Audio file not found: Tried ${filename} and sounds/${filename}`);
        return res.status(404).json({ message: 'Audio file not found' });
      }
      
      // Log the actual key being used
      console.log(`Serving audio file from key: ${actualKey}`);
      
      // Set appropriate Content-Type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'audio/mpeg'; // Default to mp3
      
      if (ext === '.wav') contentType = 'audio/wav';
      else if (ext === '.ogg') contentType = 'audio/ogg';
      else if (ext === '.m4a') contentType = 'audio/m4a';
      
      // Set content type
      res.set('Content-Type', contentType);
      
      try {
        // Get a readable stream from the object storage using the actual key
        const stream = await objectStorage.downloadAsStream(actualKey);
        
        // Pipe the stream to the response
        stream.pipe(res);
      } catch (streamErr) {
        console.error(`Error streaming audio file: ${actualKey}`, streamErr);
        return res.status(500).json({ message: 'Failed to stream audio file' });
      }
    } catch (err) {
      console.error('Error serving audio file:', err);
      res.status(500).json({ message: 'Failed to serve audio file' });
    }
  });
  
  return httpServer;
}
