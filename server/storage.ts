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
  duration: number | null; // in seconds
  uploadedAt: string; // ISO date string
}

// Helper functions for key-value metadata
const getSoundMetadataKey = (filename: string) => `sound:${filename}`;

async function getSoundMetadata(filename: string): Promise<SoundMetadata | null> {
  try {
    const key = getSoundMetadataKey(filename);
    const metadata = await db.get(key);
    if (!metadata) return null;
    return metadata as SoundMetadata;
  } catch (error) {
    console.error(`Error getting metadata for ${filename}:`, error);
    return null;
  }
}

async function saveSoundMetadata(filename: string, metadata: SoundMetadata): Promise<void> {
  try {
    const key = getSoundMetadataKey(filename);
    await db.set(key, metadata);
  } catch (error) {
    console.error(`Error saving metadata for ${filename}:`, error);
  }
}

async function deleteSoundMetadata(filename: string): Promise<void> {
  try {
    const key = getSoundMetadataKey(filename);
    await db.delete(key);
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
  saveFile(buffer: Buffer, originalname: string, uploader?: string | null, duration?: number | null): Promise<string>;
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

      // Convert bucket objects to Sound objects
      const sounds: Sound[] = await Promise.all(
        files.map(async (file) => {
          // Check if we already have this sound in our collection
          const existingSound = Array.from(this.sounds.values()).find(
            (s) => s.filename === file.name,
          );

          if (existingSound) {
            return existingSound;
          }

          // Get metadata from database if available
          const metadata = await getSoundMetadata(file.name);
          
          // Create a new sound entry for this file
          const id = this.currentSoundId++;
          const fileNameWithoutExt = path.basename(
            file.name,
            path.extname(file.name),
          );

          const newSound: Sound = {
            id,
            name: fileNameWithoutExt,
            filename: file.name,
            category: "effects",
            duration: metadata?.duration || null,
            uploader: metadata?.uploader || null,
            uploadedAt: metadata?.uploadedAt ? new Date(metadata.uploadedAt) : new Date(),
          };

          // Save in our in-memory collection
          this.sounds.set(id, newSound);

          return newSound;
        }),
      );

      return sounds;
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
    return Array.from(this.sounds.values()).find(sound => sound.filename === filename);
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
      duration: insertSound.duration || null,
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
        const deleteResult = await objectStorage.delete(sound.filename);

        if (!deleteResult.ok) {
          console.error(
            `Failed to delete sound file from storage: ${sound.filename}`,
            deleteResult.error,
          );
          // Continue with removal from in-memory collection even if bucket deletion fails
        } else {
          console.log(`Deleted sound file from storage: ${sound.filename}`);
          
          // Also delete metadata from database
          await deleteSoundMetadata(sound.filename);
          console.log(`Deleted metadata for: ${sound.filename}`);
        }
      }

      // Remove from in-memory collection
      return this.sounds.delete(id);
    } catch (error) {
      console.error(`Error deleting sound file: ${sound.filename}`, error);
      return false;
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
  async saveFile(buffer: Buffer, originalname: string, uploader: string | null = null, duration: number | null = null): Promise<string> {
    const ext = path.extname(originalname);

    // Use provided name (from form title field) as the filename instead of a UUID
    // The file is stored as "Title.mp3" in the bucket
    const filename = originalname;

    // Create a readable stream from the buffer
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    try {
      // Upload the file to Object Storage
      const uploadResult = await objectStorage.uploadFromStream(
        filename,
        readableStream,
      );

      if (!uploadResult?.ok) {
        console.error(
          `Failed to upload file: ${filename}`,
          uploadResult?.error,
        );
        throw new Error(
          `Failed to upload file: ${uploadResult?.error || "Unknown error"}`,
        );
      }
      
      // Save metadata to database
      const metadata: SoundMetadata = {
        uploader,
        duration,
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
    // This now returns a URL path for the API endpoint that will stream the file
    return `/api/audio/${encodeURIComponent(filename)}`;
  }

  getObjectStorage() {
    // Return the Replit Object Storage client
    return objectStorage;
  }
}

export const storage = new MemStorage();
