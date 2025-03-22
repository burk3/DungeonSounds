// Helper functions for interacting with Replit Database
import Database from "@replit/database";

// Initialize Replit Database for metadata
const db = new Database();

// Define user data structure
export interface UserData {
  email: string;
  isAdmin: boolean;
  createdAt?: string; // ISO date string
}

// Helper functions for key-value metadata
const getUserKey = (email: string) => `user:${email.toLowerCase()}`;

export async function getUserData(email: string): Promise<UserData | null> {
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

export async function saveUserData(email: string, userData: UserData): Promise<void> {
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

export async function getAllUserKeys(): Promise<string[]> {
  try {
    // List all keys that start with "user:"
    const result = await db.list("user:");
    
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