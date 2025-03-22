import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sound categories - simplified to just effects
export const SOUND_CATEGORIES = ["effects"] as const;
export type SoundCategory = typeof SOUND_CATEGORIES[number];

// Sound schema
export const sounds = pgTable("sounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  category: text("category").notNull(),
  duration: integer("duration"), // in seconds
  uploader: text("uploader"), // username of the uploader
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSoundSchema = createInsertSchema(sounds).pick({
  name: true,
  filename: true,
  category: true,
  duration: true,
  uploader: true,
});

export type InsertSound = z.infer<typeof insertSoundSchema>;
export type Sound = typeof sounds.$inferSelect;

// Message types for WebSocket communication
export type WSMessageType = 
  | "connect" 
  | "play" 
  | "stop" 
  | "volume" 
  | "soundAdded" 
  | "nowPlaying" 
  | "error";

export type WSMessage = {
  type: WSMessageType;
  data?: any;
};

export type PlaySoundMessage = {
  soundId: number;
};

export type VolumeMessage = {
  volume: number;
};

export type NowPlayingMessage = {
  sound: Sound | null;
};

export type SoundAddedMessage = {
  sound: Sound;
};

export type ConnectMessage = {
  clientType: "playback" | "remote";
  clientId?: string;
};

export type ErrorMessage = {
  message: string;
};
