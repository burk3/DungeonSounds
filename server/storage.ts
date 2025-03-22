import { sounds, type Sound, type InsertSound, type SoundCategory } from "@shared/schema";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage interface
export interface IStorage {
  // Sound operations
  getSounds(): Promise<Sound[]>;
  getSoundsByCategory(category: SoundCategory): Promise<Sound[]>;
  getSound(id: number): Promise<Sound | undefined>;
  createSound(sound: InsertSound): Promise<Sound>;
  deleteSound(id: number): Promise<boolean>;
  
  // File operations
  saveFile(buffer: Buffer, originalname: string): Promise<string>;
  getFilePath(filename: string): string;
}

export class MemStorage implements IStorage {
  private sounds: Map<number, Sound>;
  private currentId: number;

  constructor() {
    this.sounds = new Map();
    this.currentId = 1;
  }

  async getSounds(): Promise<Sound[]> {
    return Array.from(this.sounds.values());
  }

  async getSoundsByCategory(category: SoundCategory): Promise<Sound[]> {
    return Array.from(this.sounds.values()).filter(
      (sound) => sound.category === category
    );
  }

  async getSound(id: number): Promise<Sound | undefined> {
    return this.sounds.get(id);
  }

  async createSound(insertSound: InsertSound): Promise<Sound> {
    const id = this.currentId++;
    const sound: Sound = { 
      ...insertSound, 
      id, 
      duration: insertSound.duration || null,
      uploader: insertSound.uploader || null,
      uploadedAt: new Date()
    };
    this.sounds.set(id, sound);
    return sound;
  }

  async deleteSound(id: number): Promise<boolean> {
    return this.sounds.delete(id);
  }

  async saveFile(buffer: Buffer, originalname: string): Promise<string> {
    const ext = path.extname(originalname);
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    
    await fs.promises.writeFile(filePath, buffer);
    return filename;
  }

  getFilePath(filename: string): string {
    return path.join(uploadsDir, filename);
  }
}

export const storage = new MemStorage();
