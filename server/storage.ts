import {
  type Sound,
  type InsertSound,
  type SoundCategory,
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

// Define user data structure
interface UserData {
  email: string;
  isAdmin: boolean;
  createdAt?: string; // ISO date string
}

// Helper functions for key-value metadata
const getSoundMetadataKey = (filename: string) => `sound:${filename}`;
const getUserKey = (email: string) => `user:${email.toLowerCase()}`;

async function getSoundMetadata(
  filename: string,
): Promise<SoundMetadata | null> {
  try {
    // Try with clean filename (no prefix)
    const cleanFilename = filename.replace(/^sounds\//, "");
    const key = getSoundMetadataKey(cleanFilename);
    let dbResult = await db.get(key);
    
    // Replit Database wraps results in an ok/value structure
    // First, check if we have a wrapped result and extract the value
    let metadata = dbResult;
    if (dbResult && typeof dbResult === 'object' && 'ok' in dbResult && dbResult.ok === true && 'value' in dbResult) {
      metadata = dbResult.value;
    }

    // If not found and filename was cleaned, try with original filename (might be legacy)
    if (!metadata && cleanFilename !== filename) {
      const originalKey = getSoundMetadataKey(filename);
      dbResult = await db.get(originalKey);
      
      // Check for wrapped result again
      if (dbResult && typeof dbResult === 'object' && 'ok' in dbResult && dbResult.ok === true && 'value' in dbResult) {
        metadata = dbResult.value;
      } else {
        metadata = dbResult;
      }

      if (metadata) {
        console.log(`Found metadata using legacy path: ${filename}`);
      }
    }

    if (!metadata) {
      // Create default metadata if none exists
      const defaultMetadata: SoundMetadata = {
        uploader: null,
        uploadedAt: new Date().toISOString()
      };
      
      // Save the default metadata
      await saveSoundMetadata(cleanFilename, defaultMetadata);
      console.log(`Created default metadata for ${cleanFilename}`);
      
      return defaultMetadata;
    }

    // Verify the returned object has the required properties
    if (
      typeof metadata === "object" &&
      "uploader" in metadata &&
      "uploadedAt" in metadata
    ) {
      return metadata as SoundMetadata;
    }

    // Create a valid metadata format from whatever we have
    console.log(`Fixing invalid metadata format for ${filename}`);
    const fixedMetadata: SoundMetadata = {
      uploader: typeof metadata === 'object' && metadata && 'uploader' in metadata ? 
        (metadata.uploader as string | null) : null,
      uploadedAt: typeof metadata === 'object' && metadata && 'uploadedAt' in metadata ? 
        (metadata.uploadedAt as string) : new Date().toISOString()
    };
    
    // Save the corrected metadata
    await saveSoundMetadata(cleanFilename, fixedMetadata);
    console.log(`Fixed metadata for ${cleanFilename}`);
    
    return fixedMetadata;
  } catch (error) {
    console.error(`Error getting metadata for ${filename}:`, error);
    
    // Return a default metadata on error
    const defaultMetadata: SoundMetadata = {
      uploader: null,
      uploadedAt: new Date().toISOString()
    };
    
    return defaultMetadata;
  }
}

async function saveSoundMetadata(
  filename: string,
  metadata: SoundMetadata,
): Promise<void> {
  try {
    // Always use clean filename (no prefix) for consistency
    const cleanFilename = filename.replace(/^sounds\//, "");
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
    const cleanFilename = filename.replace(/^sounds\//, "");
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

// User related database functions
async function saveUserData(email: string, userData: UserData): Promise<void> {
  try {
    // Normalize email to lowercase for consistent lookup
    const normalizedEmail = email.toLowerCase();
    const key = getUserKey(normalizedEmail);
    
    // Make sure userData has the normalized email
    const normalizedUserData: UserData = {
      ...userData,
      email: normalizedEmail,
      createdAt: userData.createdAt || new Date().toISOString()
    };
    
    // Save to database
    await db.set(key, normalizedUserData);
    console.log(`Saved user data for: ${normalizedEmail}`);
  } catch (error) {
    console.error(`Error saving user data for ${email}:`, error);
  }
}

async function getUserData(email: string): Promise<UserData | null> {
  try {
    const key = getUserKey(email);
    const result = await db.get(key);

    if (!result) return null;

    // Handle the Replit Database format which returns {ok: true, value: {...}}
    let userData: any;
    
    if (typeof result === "object" && "ok" in result && result.ok === true && "value" in result) {
      // Extract actual user data from the "value" property
      userData = result.value;
    } else {
      // For backward compatibility, try to use the result directly
      userData = result;
    }

    // Validate the data has at least email and isAdmin
    if (typeof userData === "object") {
      // Handle wrapped data (sometimes Replit DB nests data in another layer)
      if ("value" in userData && typeof userData.value === "object") {
        userData = userData.value;
      }

      if ("email" in userData && "isAdmin" in userData) {
        return userData as UserData;
      }
    }

    console.warn(`Invalid user data format for ${email}`);
    console.log(`User data key: ${key}`);
    console.log(`User data:`, userData);
    return null;
  } catch (error) {
    console.error(`Error getting user data for ${email}:`, error);
    return null;
  }
}

async function deleteUserData(email: string): Promise<void> {
  try {
    const key = getUserKey(email);
    await db.delete(key);
    console.log(`Deleted user data for: ${email}`);
  } catch (error) {
    console.error(`Error deleting user data for ${email}:`, error);
  }
}

async function getAllUserKeys(): Promise<string[]> {
  try {
    // List all keys that start with "user:"
    const result = await db.list("user:");
    console.log("DB list result:", result);
    
    // Handle the Replit Database format which returns {ok: true, value: {...}}
    let keys: any;
    
    if (typeof result === "object" && "ok" in result && result.ok === true && "value" in result) {
      // For newer Replit Database format, the value contains an array of keys
      if (Array.isArray(result.value)) {
        return result.value; // Return the array of keys directly
      }
      
      // Otherwise, extract actual keys from the "value" property
      keys = result.value;
    } else {
      // For backward compatibility, try to use the result directly
      keys = result;
    }
    
    if (!keys || typeof keys !== 'object') {
      console.log("No keys found or invalid format");
      return [];
    }
    
    // Get the keys from the object
    return Object.keys(keys);
  } catch (error) {
    console.error("Error listing user keys:", error);
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
  getAllowedUserByUid(uid: string): Promise<AllowedUser | undefined>; // Deprecated
  createAllowedUser(user: InsertAllowedUser): Promise<AllowedUser>;
  updateAllowedUser(
    id: number,
    updates: Partial<AllowedUser>,
  ): Promise<AllowedUser | undefined>;
  deleteAllowedUser(id: number): Promise<boolean>;
  isUserAllowed(email: string): Promise<boolean>;
  isUserAdmin(email: string): Promise<boolean>;

  // File operations
  saveFile(
    buffer: Buffer,
    originalname: string,
    uploader?: string | null,
  ): Promise<string>;
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
    
    // No longer add hardcoded admin users on startup
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

      // Process files and build array of sounds to return
      const processedSounds: Sound[] = [];

      for (const file of files) {
        // Clean the filename from the object storage
        const originalFilename = file.name;
        const cleanFilename = originalFilename.replace(/^sounds\//, "");

        // Skip if we've already processed this file (by its clean name)
        if (processedFiles.has(cleanFilename)) {
          continue;
        }

        processedFiles.add(cleanFilename);

        // Find an existing sound with the same filename (with or without prefix)
        const existingSound = Array.from(this.sounds.values()).find((sound) => {
          const cleanSoundFilename = sound.filename.replace(/^sounds\//, "");
          return (
            sound.filename === originalFilename ||
            cleanSoundFilename === cleanFilename ||
            sound.filename === cleanFilename ||
            cleanSoundFilename === originalFilename
          );
        });

        if (existingSound) {
          processedSounds.push(existingSound);
          continue;
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
          uploadedAt: metadata?.uploadedAt
            ? new Date(metadata.uploadedAt)
            : new Date(),
        };

        // Save in our in-memory collection
        this.sounds.set(id, newSound);
        console.log(`Added sound: ${newSound.name} (${newSound.filename})`);

        processedSounds.push(newSound);
      }

      return processedSounds;
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
    const cleanInputFilename = filename.replace(/^sounds\//, "");

    // Find a sound by comparing with its filename, trying both with and without prefix
    return Array.from(this.sounds.values()).find((sound) => {
      const cleanSoundFilename = sound.filename.replace(/^sounds\//, "");
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
        const cleanFilename = sound.filename.replace(/^sounds\//, "");
        let deleteSuccess = false;

        // Try to delete without prefix first
        try {
          const deleteResult = await objectStorage.delete(cleanFilename);
          if (deleteResult.ok) {
            console.log(`Deleted sound file from storage: ${cleanFilename}`);
            deleteSuccess = true;
          }
        } catch (error) {
          console.log(
            `File not found at path: ${cleanFilename}, trying with prefix...`,
          );
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
    try {
      // Create a set to track which users we've processed
      const processedEmails = new Set<string>();
      const validUsers: AllowedUser[] = [];
      
      // Now get any additional keys from the database
      const userKeys = await getAllUserKeys();
      console.log("Found user keys:", userKeys);

      // Load and process remaining users
      for (const key of userKeys) {
        // Extract email from key (remove "user:" prefix)
        const email = key.replace(/^user:/, "").toLowerCase();
        
        // Skip if we've already processed this email
        if (processedEmails.has(email)) {
          continue;
        }
        
        processedEmails.add(email);
        const userData = await getUserData(email);

        if (!userData) continue;

        // Convert to AllowedUser format
        const id = this.currentUserId++; // Generate an in-memory ID
        const user: AllowedUser = {
          id,
          email: userData.email,
          isAdmin: userData.isAdmin,
          createdAt: userData.createdAt
            ? new Date(userData.createdAt)
            : new Date(),
        };

        validUsers.push(user);
      }

      console.log("Returning users:", validUsers);
      
      // Update in-memory collection for faster access later
      this.allowedUsers.clear();
      validUsers.forEach((user) => {
        this.allowedUsers.set(user.id, user);
      });

      return validUsers;
    } catch (error) {
      console.error("Error loading users from database:", error);
      return Array.from(this.allowedUsers.values());
    }
  }

  async getAllowedUserByEmail(email: string): Promise<AllowedUser | undefined> {
    // Check in-memory cache first for faster response
    const cachedUser = Array.from(this.allowedUsers.values()).find(
      (user) => user.email === email,
    );

    if (cachedUser) {
      return cachedUser;
    }

    // If not found in cache, check database
    const userData = await getUserData(email);

    if (!userData) {
      return undefined;
    }

    // Convert to AllowedUser and cache it
    const id = this.currentUserId++;
    const user: AllowedUser = {
      id,
      email: userData.email,
      isAdmin: userData.isAdmin,
      createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
    };

    // Add to in-memory cache
    this.allowedUsers.set(id, user);
    return user;
  }

  // This method is deprecated - we no longer use UIDs
  async getAllowedUserByUid(uid: string): Promise<AllowedUser | undefined> {
    console.warn(
      "getAllowedUserByUid is deprecated - uid field has been removed",
    );
    return undefined;
  }

  async createAllowedUser(user: InsertAllowedUser): Promise<AllowedUser> {
    // Check if user already exists in database
    const existingUserData = await getUserData(user.email);

    if (existingUserData) {
      // User exists, convert to AllowedUser format
      const id = this.currentUserId++;
      const existingUser: AllowedUser = {
        id,
        email: existingUserData.email,
        isAdmin: existingUserData.isAdmin,
        createdAt: existingUserData.createdAt
          ? new Date(existingUserData.createdAt)
          : new Date(),
      };

      // Add to in-memory collection
      this.allowedUsers.set(id, existingUser);
      return existingUser;
    }

    // Create new user in database
    const now = new Date();
    const userData: UserData = {
      email: user.email,
      isAdmin: user.isAdmin === true,
      createdAt: now.toISOString(),
    };

    await saveUserData(user.email, userData);

    // Create in-memory version
    const id = this.currentUserId++;
    const newUser: AllowedUser = {
      id,
      email: user.email,
      isAdmin: user.isAdmin === true,
      createdAt: now,
    };

    // Add to in-memory collection
    this.allowedUsers.set(id, newUser);
    console.log(
      `Created new user: ${user.email}, isAdmin: ${user.isAdmin === true}`,
    );
    return newUser;
  }

  async updateAllowedUser(
    id: number,
    updates: Partial<AllowedUser>,
  ): Promise<AllowedUser | undefined> {
    // Get the user from in-memory collection
    const user = this.allowedUsers.get(id);
    if (!user) return undefined;

    // Update in-memory version
    const updatedUser: AllowedUser = { ...user, ...updates };
    this.allowedUsers.set(id, updatedUser);

    // Update in database
    const userData = await getUserData(user.email);

    if (userData) {
      // Update the database copy
      const updatedUserData: UserData = {
        ...userData,
        isAdmin: updatedUser.isAdmin,
      };

      await saveUserData(user.email, updatedUserData);
      console.log(`Updated user data for: ${user.email}`);
    } else {
      // Create new record in database
      const newUserData: UserData = {
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        createdAt: updatedUser.createdAt
          ? updatedUser.createdAt.toISOString()
          : new Date().toISOString(),
      };

      await saveUserData(updatedUser.email, newUserData);
    }

    return updatedUser;
  }

  async deleteAllowedUser(id: number): Promise<boolean> {
    // Get user from in-memory collection
    const user = this.allowedUsers.get(id);
    if (!user) return false;

    // Delete from database
    await deleteUserData(user.email);

    // Delete from in-memory collection
    return this.allowedUsers.delete(id);
  }

  async isUserAllowed(email: string): Promise<boolean> {
    if (!email) return false;

    // First check if we have the admin user hardcoded
    if (email.toLowerCase() === "burke.cates@gmail.com") {
      console.log("Admin user detected:", email);
      return true;
    }

    // Then check if user exists in database
    const userData = await getUserData(email);
    return !!userData;
  }

  async isUserAdmin(email: string): Promise<boolean> {
    if (!email) return false;

    // First check if we have the admin user hardcoded
    if (email.toLowerCase() === "burke.cates@gmail.com") {
      console.log("Admin user detected:", email);
      // We still need to check the database to be consistent
    }

    // Check if user exists and is admin
    const userData = await getUserData(email);
    
    if (userData && userData.isAdmin) {
      console.log("Admin privileges confirmed for:", email);
      return true;
    }
    
    // Special case - always grant admin privileges to the main admin
    if (email.toLowerCase() === "burke.cates@gmail.com") {
      console.log("Admin privileges granted to hardcoded admin:", email);
      return true;
    }
    
    return false;
  }

  // File operations
  async saveFile(
    buffer: Buffer,
    title: string,
    uploader: string | null = null,
  ): Promise<string> {
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
        readableStream,
      );

      // Handle different response structures to make this more robust
      if (typeof uploadResult === "object" && uploadResult !== null) {
        const result = uploadResult as any;
        if (result.ok === false) {
          console.error(
            `Failed to upload file: ${filename}`,
            result.error || "Unknown error",
          );
          throw new Error(
            `Failed to upload file: ${result.error || "Unknown error"}`,
          );
        }
      }

      // Save metadata to database
      const metadata: SoundMetadata = {
        uploader,
        uploadedAt: new Date().toISOString(),
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
    const cleanFilename = filename.startsWith("sounds/")
      ? filename.substring(7)
      : filename;
    // This returns a URL path for the API endpoint that will stream the file
    return `/api/audio/${encodeURIComponent(cleanFilename)}`;
  }

  getObjectStorage() {
    // Return the Replit Object Storage client
    return objectStorage;
  }
}

export const storage = new MemStorage();
