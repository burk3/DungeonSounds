// Script to add an admin user to the D&D Soundboard
import { getUserData, saveUserData } from './storageHelpers';
import type { UserData } from './storageHelpers';

const email = process.argv[2];

if (!email) {
  console.error('Error: Email address is required');
  console.log('Usage: npm run makeAdminUser <email address>');
  process.exit(1);
}

async function createAdminUser(email: string) {
  try {
    // Normalize email
    const normalizedEmail = email.toLowerCase();
    
    // Check if user already exists
    const existingUser = await getUserData(normalizedEmail);
    
    if (existingUser) {
      // Update existing user to be admin
      const updatedUser: UserData = {
        ...existingUser,
        isAdmin: true
      };
      
      await saveUserData(normalizedEmail, updatedUser);
      console.log(`✅ User ${normalizedEmail} updated to admin status.`);
    } else {
      // Create new admin user
      const now = new Date();
      const newUser: UserData = {
        email: normalizedEmail,
        isAdmin: true,
        createdAt: now.toISOString()
      };
      
      await saveUserData(normalizedEmail, newUser);
      console.log(`✅ New admin user created: ${normalizedEmail}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error creating admin user: ${error}`);
    process.exit(1);
  }
}

createAdminUser(email);