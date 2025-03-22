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
import { eq } from "drizzle-orm";
import { db } from "./db";

// Initialize Replit Object Storage
const objectStorage = new Client({
  bucketId: "replit-objstore-69f8cf84-ce3d-473a-bcaa-4bb1d0ea232f",
});
const BUCKET_NAME = "sounds";

// Initialize Replit Database for metadata
const metadataDB = new Database();

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
    let metadata = await metadataDB.get(key);
    
    // If not found and filename was cleaned, try with original filename (might be legacy)
    if (!metadata && cleanFilename !== filename) {
      const originalKey = getSoundMetadataKey(filename);
      metadata = await metadataDB.get(originalKey);
      
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
    await metadataDB.set(key, metadata);
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
    await metadataDB.delete(key);
    
    // Also try to delete with prefix (for legacy files)
    if (cleanFilename !== filename) {
      const legacyKey = getSoundMetadataKey(filename);
      try {
        await metadataDB.delete(legacyKey);
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
    const keys = await metadataDB.list("sound:");
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

// Database Storage implementation
export class DatabaseStorage implements IStorage {
  private objectStorage: Client;
  
  constructor() {
    this.objectStorage = objectStorage;
    this.setupAdminUser().catch(err => console.error("Failed to setup admin user:", err));
  }
  
  private async setupAdminUser() {
    try {
      // Check if admin user exists with Email
      const adminEmail = "burke.cates@gmail.com";
      
      // Check if admin exists
      const adminUser = await this.getAllowedUserByEmail(adminEmail);
      
      if (!adminUser) {
        // Create admin user
        await this.createAllowedUser({
          email: adminEmail,
          displayName: "Admin",
          isAdmin: true,
          uid: null, // Will be set when user logs in
        });
        console.log("Admin user created:", adminEmail);
      } else if (!adminUser.isAdmin) {
        // Upgrade to admin if not already
        await this.updateAllowedUser(adminUser.id, { isAdmin: true });
        console.log("User upgraded to admin:", adminEmail);
      } else {
        console.log("Admin user already exists:", adminEmail);
      }
    } catch (error) {
      console.error("Failed to setup admin user:", error);
    }
  }
  
  // Sound operations
  async getSounds(): Promise<Sound[]> {
    try {
      // Get list of all files in the bucket
      const listResult = await objectStorage.list();

      if (!listResult.ok) {
        console.error("Failed to list files from bucket:", listResult.error);
        return [];
      }

      const files = listResult.value;
      console.log(`Found ${files.length} files in object storage`);
      
      // Get all sounds from the database
      const results = await db.select().from(sounds);
      
      // Track which files we've processed to avoid duplicates
      const processedFilenames = new Set<string>(
        results.map(s => s.filename.replace(/^sounds\//, ''))
      );
      
      // Add any files in object storage that aren't in DB
      const soundsToAdd: Promise<Sound>[] = [];
      
      for (const file of files) {
        // Clean the filename from the object storage
        const originalFilename = file.name;
        const cleanFilename = originalFilename.replace(/^sounds\//, '');
        
        // Skip if we've already processed this file (by its clean name)
        if (processedFilenames.has(cleanFilename)) {
          continue;
        }
        
        // Try to get metadata
        const metadata = await getSoundMetadata(originalFilename);
        
        // Create sound entry for this file
        const newSound: InsertSound = {
          name: cleanFilename, // Use filename as fallback name
          filename: originalFilename,
          category: "effects", // Default category
          uploader: metadata?.uploader || null,
        };
        
        soundsToAdd.push(this.createSound(newSound));
      }
      
      // Add any missing sounds
      const newSounds = await Promise.all(soundsToAdd);
      
      // Combine existing and new sounds
      return [...results, ...newSounds];
    } catch (error) {
      console.error("Error getting sounds:", error);
      return [];
    }
  }
  
  async getSoundsByCategory(category: SoundCategory): Promise<Sound[]> {
    try {
      return await db.select().from(sounds).where(eq(sounds.category, category));
    } catch (error) {
      console.error(`Error getting sounds by category ${category}:`, error);
      return [];
    }
  }
  
  async getSound(id: number): Promise<Sound | undefined> {
    try {
      const [sound] = await db.select().from(sounds).where(eq(sounds.id, id));
      return sound;
    } catch (error) {
      console.error(`Error getting sound with id ${id}:`, error);
      return undefined;
    }
  }
  
  async getSoundByFilename(filename: string): Promise<Sound | undefined> {
    try {
      // Try both with and without the 'sounds/' prefix
      const [sound] = await db.select().from(sounds).where(eq(sounds.filename, filename));
      
      if (sound) return sound;
      
      // Try with the alternate version
      const alternateFilename = filename.startsWith('sounds/') 
        ? filename.substring(7) 
        : `sounds/${filename}`;
        
      const [alternateSound] = await db.select().from(sounds).where(eq(sounds.filename, alternateFilename));
      return alternateSound;
    } catch (error) {
      console.error(`Error getting sound by filename ${filename}:`, error);
      return undefined;
    }
  }
  
  async soundTitleExists(title: string): Promise<boolean> {
    try {
      const [sound] = await db.select().from(sounds).where(eq(sounds.name, title));
      return !!sound;
    } catch (error) {
      console.error(`Error checking if sound title exists: ${title}`, error);
      return false;
    }
  }
  
  async createSound(insertSound: InsertSound): Promise<Sound> {
    try {
      const [sound] = await db.insert(sounds).values(insertSound).returning();
      return sound;
    } catch (error) {
      console.error("Error creating sound:", error);
      throw new Error(`Failed to create sound: ${error}`);
    }
  }
  
  async deleteSound(id: number): Promise<boolean> {
    try {
      // Get the sound to delete
      const [sound] = await db.select().from(sounds).where(eq(sounds.id, id));
      
      if (!sound) {
        console.error(`Sound with id ${id} not found`);
        return false;
      }
      
      // Delete from database
      await db.delete(sounds).where(eq(sounds.id, id));
      
      // Delete from object storage
      const filename = sound.filename;
      try {
        // Try to delete the file from object storage
        await this.objectStorage.delete(filename);
        console.log(`Successfully deleted file ${filename} from object storage`);
        
        // Also try to delete metadata
        await deleteSoundMetadata(filename);
        
      } catch (error) {
        console.error(`Error deleting file ${filename} from object storage:`, error);
        // We continue even if deletion fails
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting sound with id ${id}:`, error);
      return false;
    }
  }
  
  // User operations
  async getAllowedUsers(): Promise<AllowedUser[]> {
    try {
      return await db.select().from(allowedUsers);
    } catch (error) {
      console.error("Error getting allowed users:", error);
      return [];
    }
  }
  
  async getAllowedUserByEmail(email: string): Promise<AllowedUser | undefined> {
    try {
      const [user] = await db.select().from(allowedUsers).where(eq(allowedUsers.email, email));
      return user;
    } catch (error) {
      console.error(`Error getting allowed user by email ${email}:`, error);
      return undefined;
    }
  }
  
  async getAllowedUserByUid(uid: string): Promise<AllowedUser | undefined> {
    try {
      const [user] = await db.select().from(allowedUsers).where(eq(allowedUsers.uid, uid));
      return user;
    } catch (error) {
      console.error(`Error getting allowed user by uid ${uid}:`, error);
      return undefined;
    }
  }
  
  async createAllowedUser(user: InsertAllowedUser): Promise<AllowedUser> {
    try {
      const [newUser] = await db.insert(allowedUsers).values(user).returning();
      return newUser;
    } catch (error) {
      console.error("Error creating allowed user:", error);
      throw new Error(`Failed to create allowed user: ${error}`);
    }
  }
  
  async updateAllowedUser(
    id: number,
    updates: Partial<AllowedUser>,
  ): Promise<AllowedUser | undefined> {
    try {
      const [updatedUser] = await db
        .update(allowedUsers)
        .set(updates)
        .where(eq(allowedUsers.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error(`Error updating allowed user with id ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteAllowedUser(id: number): Promise<boolean> {
    try {
      await db.delete(allowedUsers).where(eq(allowedUsers.id, id));
      return true;
    } catch (error) {
      console.error(`Error deleting allowed user with id ${id}:`, error);
      return false;
    }
  }
  
  async isUserAllowed(email: string): Promise<boolean> {
    try {
      const user = await this.getAllowedUserByEmail(email);
      return !!user;
    } catch (error) {
      console.error(`Error checking if user is allowed: ${email}`, error);
      return false;
    }
  }
  
  async isUserAdmin(email: string): Promise<boolean> {
    try {
      const user = await this.getAllowedUserByEmail(email);
      return user?.isAdmin ?? false;
    } catch (error) {
      console.error(`Error checking if user is admin: ${email}`, error);
      return false;
    }
  }
  
  // File operations
  async saveFile(buffer: Buffer, originalname: string, uploader: string | null = null): Promise<string> {
    // Format safe filename with timestamp & original name
    const timestamp = Date.now();
    const cleanedName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${timestamp}_${cleanedName}`;
    
    try {
      // Create a readable stream from the buffer
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null); // End of stream
      
      // Upload to Replit Object Storage using stream
      await objectStorage.uploadFromStream(
        `sounds/${filename}`,
        readableStream
      );
      
      // Save metadata
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

// Export the storage instance
export const storage = new DatabaseStorage();