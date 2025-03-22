import { z } from "zod";

// User types
export interface AllowedUser {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: Date | null;
}

export interface InsertAllowedUser {
  email: string;
  isAdmin?: boolean;
}

// User roles
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

// Sound categories - simplified to just effects
export const SOUND_CATEGORIES = ["effects"] as const;
export type SoundCategory = typeof SOUND_CATEGORIES[number];

// Sound types
export interface Sound {
  id: number;
  name: string;
  filename: string;
  category: string;
  uploader: string | null;
  uploadedAt: Date;
}

export interface InsertSound {
  name: string;
  filename: string;
  category: string;
  uploader: string | null;
}

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