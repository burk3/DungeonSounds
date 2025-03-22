import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Firebase authenticated users - users that are allowed to access the app
export const allowedUsers = pgTable("allowed_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAllowedUserSchema = createInsertSchema(allowedUsers).pick({
  email: true,
  isAdmin: true,
});

export type InsertAllowedUser = z.infer<typeof insertAllowedUserSchema>;
export type AllowedUser = typeof allowedUsers.$inferSelect;

// User roles
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

// Sound categories - simplified to just effects
export const SOUND_CATEGORIES = ["effects"] as const;
export type SoundCategory = typeof SOUND_CATEGORIES[number];

// Sound schema
export const sounds = pgTable("sounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  category: text("category").notNull(),
  uploader: text("uploader"), // username of the uploader
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSoundSchema = createInsertSchema(sounds).pick({
  name: true,
  filename: true,
  category: true,
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
  | "soundDeleted" 
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

export type SoundDeletedMessage = {
  id: number;
};

export type ConnectMessage = {
  clientType: "playback" | "remote";
  clientId?: string;
};

export type ErrorMessage = {
  message: string;
};
