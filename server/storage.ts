import {
  sounds,
  type Sound,
  type InsertSound,
  type SoundCategory,
  allowedUsers,
  type AllowedUser,
  type InsertAllowedUser,
} from "@shared/schema";
import path from "path";
import { Client } from "@replit/object-storage";
import { Readable } from "stream";
import Database from "@replit/database";

// Initialize Replit Object Storage
const objectStorage = new Client({
  bucketId: "replit-objstore-69f8cf84-ce3d-473a-bcaa-4bb1d0ea232f",
});
const BUCKET_NAME = "sounds";

// Initialize Replit Database for metadata
const db = new Database();

// Define metadata structure
interface SoundMetadata {
  uploader: string | null;
  uploadedAt: string; // ISO date string
}

// Helper functions for key-value metadata
const getSoundMetadataKey = (filename: string) => `sound:${filename}`;

async function getSoundMetadata(filename: string): Promise<SoundMetadata | null> {
  try {
    // Try with clean filename (no prefix)
    const cleanFilename = filename.replace(/^sounds\//, '');
    const key = getSoundMetadataKey(cleanFilename);
    let metadata = await db.get(key);
    
    // If not found and filename was cleaned, try with original filename (might be legacy)
    if (!metadata && cleanFilename !== filename) {
      const originalKey = getSoundMetadataKey(filename);
      metadata = await db.get(originalKey);
      
      if (metadata) {
        console.log(`Found metadata using legacy path: ${filename}`);
      }
    }
    
    if (!metadata) return null;
    
    // Verify the returned object has the required properties
    if (typeof metadata === 'object' && 
        'uploader' in metadata && 
        'uploadedAt' in metadata) {
      return metadata as SoundMetadata;
    }
    
    console.warn(`Invalid metadata format for ${filename}`);
    return null;
  } catch (error) {
    console.error(`Error getting metadata for ${filename}:`, error);
    return null;
  }
}

async function saveSoundMetadata(filename: string, metadata: SoundMetadata): Promise<void> {
  try {
    // Always use clean filename (no prefix) for consistency
    const cleanFilename = filename.replace(/^sounds\//, '');
    const key = getSoundMetadataKey(cleanFilename);
    await db.set(key, metadata);
    console.log(`Saved metadata with key: ${key}`);
  } catch (error) {
    console.error(`Error saving metadata for ${filename}:`, error);
  }
}

async function deleteSoundMetadata(filename: string): Promise<void> {
  try {
    // Remove any sounds/ prefix if it exists
    const cleanFilename = filename.replace(/^sounds\//, '');
    const key = getSoundMetadataKey(cleanFilename);
    await db.delete(key);
    
    // Also try to delete with prefix (for legacy files)
    if (cleanFilename !== filename) {
      const legacyKey = getSoundMetadataKey(filename);
      try {
        await db.delete(legacyKey);
      } catch (legacyError) {
        // Ignore errors for legacy key
      }
    }
  } catch (error) {
    console.error(`Error deleting metadata for ${filename}:`, error);
  }
}

async function getAllSoundKeys(): Promise<string[]> {
  try {
    // List all keys that start with "sound:"
    const keys = await db.list("sound:");
    return Object.keys(keys);
  } catch (error) {
    console.error("Error listing sound metadata keys:", error);
    return [];
  }
}

// Storage interface
export interface IStorage {
  // Sound operations
  getSounds(): Promise<Sound[]>;
  getSoundsByCategory(category: SoundCategory): Promise<Sound[]>;
  getSound(id: number): Promise<Sound | undefined>;
  getSoundByFilename(filename: string): Promise<Sound | undefined>;
  soundTitleExists(title: string): Promise<boolean>;
  createSound(sound: InsertSound): Promise<Sound>;
  deleteSound(id: number): Promise<boolean>;

  // User operations
  getAllowedUsers(): Promise<AllowedUser[]>;
  getAllowedUserByEmail(email: string): Promise<AllowedUser | undefined>;
  getAllowedUserByUid(uid: string): Promise<AllowedUser | undefined>;
  createAllowedUser(user: InsertAllowedUser): Promise<AllowedUser>;
  updateAllowedUser(
    id: number,
    updates: Partial<AllowedUser>,
  ): Promise<AllowedUser | undefined>;
  deleteAllowedUser(id: number): Promise<boolean>;
  isUserAllowed(email: string): Promise<boolean>;
  isUserAdmin(email: string): Promise<boolean>;

  // File operations
  saveFile(buffer: Buffer, originalname: string, uploader?: string | null): Promise<string>;
  getFilePath(filename: string): string;
  getObjectStorage(): any; // Exposes the Replit Object Storage client
}

export class MemStorage implements IStorage {
  private sounds: Map<number, Sound>;
  private allowedUsers: Map<number, AllowedUser>;
  private currentSoundId: number;
  private currentUserId: number;

  constructor() {
    this.sounds = new Map();
    this.allowedUsers = new Map();
    this.currentSoundId = 1;
    this.currentUserId = 1;

    // Add admin user on startup (burke.cates@gmail.com)
    this.setupAdminUser();
  }

  private async setupAdminUser() {
    const adminEmail = "burke.cates@gmail.com";
    const existingAdmin = await this.getAllowedUserByEmail(adminEmail);

    if (!existingAdmin) {
      await this.createAllowedUser({
        email: adminEmail,
        displayName: "Admin",
        isAdmin: true,
        uid: null, // Will be set when user logs in
      });
      console.log("Admin user created:", adminEmail);
    }
  }

  // Sound operations
  async getSounds(): Promise<Sound[]> {
    try {
      // Get list of all files in the bucket
      const listResult = await objectStorage.list();

      if (!listResult.ok) {
        console.error("Failed to list files from bucket:", listResult.error);
        return Array.from(this.sounds.values());
      }

      const files = listResult.value;
      console.log(`Found ${files.length} files in object storage`);
      
      // Track which files we've processed to avoid duplicates
      const processedFiles = new Set<string>();

      // Convert bucket objects to Sound objects
      const sounds: Sound[] = await Promise.all(
        files.map(async (file) => {
          // Clean the filename from the object storage
          const originalFilename = file.name;
          const cleanFilename = originalFilename.replace(/^sounds\//, '');
          
          // Skip if we've already processed this file (by its clean name)
          if (processedFiles.has(cleanFilename)) {
            return null;
          }
          
          processedFiles.add(cleanFilename);
          
          // Find an existing sound with the same filename (with or without prefix)
          const existingSound = Array.from(this.sounds.values()).find(sound => {
            const cleanSoundFilename = sound.filename.replace(/^sounds\//, '');
            return (
              sound.filename === originalFilename || 
              cleanSoundFilename === cleanFilename ||
              sound.filename === cleanFilename ||
              cleanSoundFilename === originalFilename
            );
          });

          if (existingSound) {
            return existingSound;
          }

          // Get metadata from database with our improved function that checks both path styles
          const metadata = await getSoundMetadata(originalFilename);
          
          // Create a new sound entry using the clean filename
          const id = this.currentSoundId++;
          const fileNameWithoutExt = path.basename(
            cleanFilename,
            path.extname(cleanFilename),
          );

          const newSound: Sound = {
            id,
            name: fileNameWithoutExt,
            // Store the cleaned filename without the sounds/ prefix
            filename: cleanFilename,
            category: "effects",
            uploader: metadata?.uploader || null,
            uploadedAt: metadata?.uploadedAt ? new Date(metadata.uploadedAt) : new Date(),
          };

          // Save in our in-memory collection
          this.sounds.set(id, newSound);
          console.log(`Added sound: ${newSound.name} (${newSound.filename})`);

          return newSound;
        }),
      );

      // Filter out any null entries (from skipped duplicates)
      return sounds.filter(sound => sound !== null);
    } catch (error) {
      console.error("Error listing sounds from object storage:", error);
      // Fallback to in-memory sounds
      return Array.from(this.sounds.values());
    }
  }

  async getSoundsByCategory(category: SoundCategory): Promise<Sound[]> {
    return Array.from(this.sounds.values()).filter(
      (sound) => sound.category === category,
    );
  }

  async getSound(id: number): Promise<Sound | undefined> {
    return this.sounds.get(id);
  }
  
  async getSoundByFilename(filename: string): Promise<Sound | undefined> {
    // Clean the filename that was passed in
    const cleanInputFilename = filename.replace(/^sounds\//, '');
    
    // Find a sound by comparing with its filename, trying both with and without prefix
    return Array.from(this.sounds.values()).find(sound => {
      const cleanSoundFilename = sound.filename.replace(/^sounds\//, '');
      return (
        sound.filename === filename || 
        cleanSoundFilename === cleanInputFilename ||
        sound.filename === cleanInputFilename ||
        cleanSoundFilename === filename
      );
    });
  }
  
  async soundTitleExists(title: string): Promise<boolean> {
    const filename = title; // The filename is the same as the title in our implementation
    return !!(await this.getSoundByFilename(filename));
  }

  async createSound(insertSound: InsertSound): Promise<Sound> {
    const id = this.currentSoundId++;
    const sound: Sound = {
      ...insertSound,
      id,
      uploader: insertSound.uploader || null,
      uploadedAt: new Date(),
    };
    this.sounds.set(id, sound);
    return sound;
  }

  async deleteSound(id: number): Promise<boolean> {
    const sound = this.sounds.get(id);
    if (!sound) {
      return false;
    }

    try {
      // Delete from object storage if we have a filename
      if (sound.filename) {
        // Get clean filename (remove any directory prefix)
        const cleanFilename = sound.filename.replace(/^sounds\//, '');
        let deleteSuccess = false;
        
        // Try to delete without prefix first
        try {
          const deleteResult = await objectStorage.delete(cleanFilename);
          if (deleteResult.ok) {
            console.log(`Deleted sound file from storage: ${cleanFilename}`);
            deleteSuccess = true;
          }
        } catch (error) {
          console.log(`File not found at path: ${cleanFilename}, trying with prefix...`);
        }
        
        // If direct deletion failed, try with the sounds/ prefix
        if (!deleteSuccess) {
          try {
            const prefixedKey = `sounds/${cleanFilename}`;
            const deleteResult = await objectStorage.delete(prefixedKey);
            if (deleteResult.ok) {
              console.log(`Deleted sound file from storage: ${prefixedKey}`);
              deleteSuccess = true;
            } else {
              console.error(
                `Failed to delete sound file from storage: ${prefixedKey}`,
                deleteResult.error,
              );
            }
          } catch (error) {
            console.error(`Error deleting with prefix: ${error}`);
          }
        }
        
        // Always delete the metadata
        await deleteSoundMetadata(cleanFilename);
        console.log(`Deleted metadata for: ${cleanFilename}`);
      }

      // Remove from in-memory collection regardless of storage deletion result
      return this.sounds.delete(id);
    } catch (error) {
      console.error(`Error deleting sound file: ${sound.filename}`, error);
      // Still remove from in-memory collection even if storage delete fails
      return this.sounds.delete(id);
    }
  }

  // User operations
  async getAllowedUsers(): Promise<AllowedUser[]> {
    return Array.from(this.allowedUsers.values());
  }

  async getAllowedUserByEmail(email: string): Promise<AllowedUser | undefined> {
    return Array.from(this.allowedUsers.values()).find(
      (user) => user.email === email,
    );
  }

  async getAllowedUserByUid(uid: string): Promise<AllowedUser | undefined> {
    return Array.from(this.allowedUsers.values()).find(
      (user) => user.uid === uid,
    );
  }

  async createAllowedUser(user: InsertAllowedUser): Promise<AllowedUser> {
    const id = this.currentUserId++;
    const newUser: AllowedUser = {
      id,
      email: user.email,
      displayName: user.displayName || null,
      isAdmin: user.isAdmin === true,
      uid: user.uid || null,
      lastLogin: null,
      createdAt: new Date(),
    };
    this.allowedUsers.set(id, newUser);
    return newUser;
  }

  async updateAllowedUser(
    id: number,
    updates: Partial<AllowedUser>,
  ): Promise<AllowedUser | undefined> {
    const user = this.allowedUsers.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.allowedUsers.set(id, updatedUser);
    return updatedUser;
  }

  async deleteAllowedUser(id: number): Promise<boolean> {
    return this.allowedUsers.delete(id);
  }

  async isUserAllowed(email: string): Promise<boolean> {
    const user = await this.getAllowedUserByEmail(email);
    return !!user;
  }

  async isUserAdmin(email: string): Promise<boolean> {
    const user = await this.getAllowedUserByEmail(email);
    return user ? user.isAdmin : false;
  }

  // File operations
  async saveFile(buffer: Buffer, title: string, uploader: string | null = null): Promise<string> {
    const ext = path.extname(title);
    
    // Use title as the filename (this should already include the extension from the original file)
    // The file is stored as "Title.mp3" in the bucket
    const filename = title;

    // Create a readable stream from the buffer
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    try {
      // Upload the file to Object Storage without the "sounds/" directory prefix
      // The bucket name is correctly set in the Client initialization
      const uploadResult = await objectStorage.uploadFromStream(
        filename,
        readableStream
      );

      // Handle different response structures to make this more robust
      if (typeof uploadResult === 'object' && uploadResult !== null) {
        const result = uploadResult as any;
        if (result.ok === false) {
          console.error(
            `Failed to upload file: ${filename}`,
            result.error || 'Unknown error'
          );
          throw new Error(
            `Failed to upload file: ${result.error || 'Unknown error'}`
          );
        }
      }
      
      // Save metadata to database
      const metadata: SoundMetadata = {
        uploader,
        uploadedAt: new Date().toISOString()
      };
      
      await saveSoundMetadata(filename, metadata);
      console.log(`Successfully saved metadata for: ${filename}`);

      console.log(`Successfully uploaded file: ${filename} to object storage`);
      return filename;
    } catch (error: any) {
      console.error(`Failed to upload file: ${filename}`, error);
      throw new Error(
        `Failed to upload file: ${error?.message || "Unknown error"}`,
      );
    }
  }

  getFilePath(filename: string): string {
    // Remove any 'sounds/' prefix if it exists
    const cleanFilename = filename.startsWith('sounds/') ? filename.substring(7) : filename;
    // This returns a URL path for the API endpoint that will stream the file
    return `/api/audio/${encodeURIComponent(cleanFilename)}`;
  }

  getObjectStorage() {
    // Return the Replit Object Storage client
    return objectStorage;
  }
}

export const storage = new MemStorage();
