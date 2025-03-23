// Storage/KV Store CRUD Tests
const { expect } = require('chai');

// Import the storage interface for testing
const { storage } = require('../server/storage');

describe('Storage/KV Store Operations', () => {
  // Test user for allowed users operations
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    isAdmin: false
  };
  
  // Test sound for sound operations
  const testSound = {
    name: `Test Sound ${Date.now()}`,
    filename: `test-sound-${Date.now()}.mp3`,
    category: 'effects',
    uploader: 'test@example.com'
  };
  
  // Variables to store created objects for cleanup
  let createdUserId = null;
  let createdSoundId = null;
  
  // Clean up after all tests
  after(async () => {
    // Clean up test user if created
    if (createdUserId !== null) {
      try {
        await storage.deleteAllowedUser(createdUserId);
        console.log(`Cleaned up test user with ID: ${createdUserId}`);
      } catch (error) {
        console.error(`Error cleaning up test user: ${error}`);
      }
    }
    
    // Clean up test sound if created
    if (createdSoundId !== null) {
      try {
        await storage.deleteSound(createdSoundId);
        console.log(`Cleaned up test sound with ID: ${createdSoundId}`);
      } catch (error) {
        console.error(`Error cleaning up test sound: ${error}`);
      }
    }
  });
  
  // User Operations Tests
  describe('User Operations', () => {
    it('should create a new allowed user', async () => {
      const user = await storage.createAllowedUser(testUser);
      
      expect(user).to.be.an('object');
      expect(user.id).to.be.a('number');
      expect(user.email).to.equal(testUser.email);
      expect(user.isAdmin).to.equal(testUser.isAdmin);
      expect(user.createdAt).to.be.an.instanceOf(Date);
      
      // Store the user ID for later tests and cleanup
      createdUserId = user.id;
    });
    
    it('should retrieve allowed users', async () => {
      const users = await storage.getAllowedUsers();
      
      expect(users).to.be.an('array');
      
      // Find our test user
      const testUserInList = users.find(u => u.email === testUser.email);
      expect(testUserInList).to.be.an('object');
      expect(testUserInList.id).to.equal(createdUserId);
    });
    
    it('should retrieve user by email', async () => {
      const user = await storage.getAllowedUserByEmail(testUser.email);
      
      expect(user).to.be.an('object');
      expect(user.id).to.equal(createdUserId);
      expect(user.email).to.equal(testUser.email);
    });
    
    it('should update user properties', async () => {
      const updates = {
        isAdmin: true
      };
      
      const updatedUser = await storage.updateAllowedUser(createdUserId, updates);
      
      expect(updatedUser).to.be.an('object');
      expect(updatedUser.id).to.equal(createdUserId);
      expect(updatedUser.isAdmin).to.equal(true);
      
      // Verify the update persisted in the database
      const verifyUser = await storage.getAllowedUserByEmail(testUser.email);
      expect(verifyUser.isAdmin).to.equal(true);
    });
    
    it('should correctly check if user is allowed', async () => {
      const isAllowed = await storage.isUserAllowed(testUser.email);
      expect(isAllowed).to.equal(true);
      
      const isNonexistentAllowed = await storage.isUserAllowed('nonexistent@example.com');
      expect(isNonexistentAllowed).to.equal(false);
    });
    
    it('should correctly check if user is admin', async () => {
      const isAdmin = await storage.isUserAdmin(testUser.email);
      expect(isAdmin).to.equal(true);
      
      const isNonexistentAdmin = await storage.isUserAdmin('nonexistent@example.com');
      expect(isNonexistentAdmin).to.equal(false);
    });
  });
  
  // Sound Operations Tests
  describe('Sound Operations', () => {
    it('should create a new sound', async () => {
      const sound = await storage.createSound(testSound);
      
      expect(sound).to.be.an('object');
      expect(sound.id).to.be.a('number');
      expect(sound.name).to.equal(testSound.name);
      expect(sound.filename).to.equal(testSound.filename);
      expect(sound.category).to.equal(testSound.category);
      expect(sound.uploader).to.equal(testSound.uploader);
      expect(sound.uploadedAt).to.be.an.instanceOf(Date);
      
      // Store the sound ID for later tests and cleanup
      createdSoundId = sound.id;
    });
    
    it('should retrieve all sounds', async () => {
      const sounds = await storage.getSounds();
      
      expect(sounds).to.be.an('array');
      
      // Find our test sound
      const testSoundInList = sounds.find(s => s.id === createdSoundId);
      expect(testSoundInList).to.be.an('object');
      expect(testSoundInList.name).to.equal(testSound.name);
    });
    
    it('should retrieve sounds by category', async () => {
      const categorySounds = await storage.getSoundsByCategory('effects');
      
      expect(categorySounds).to.be.an('array');
      
      // Find our test sound
      const testSoundInCategory = categorySounds.find(s => s.id === createdSoundId);
      expect(testSoundInCategory).to.be.an('object');
      expect(testSoundInCategory.category).to.equal('effects');
    });
    
    it('should retrieve sound by ID', async () => {
      const sound = await storage.getSound(createdSoundId);
      
      expect(sound).to.be.an('object');
      expect(sound.id).to.equal(createdSoundId);
      expect(sound.name).to.equal(testSound.name);
    });
    
    it('should retrieve sound by filename', async () => {
      const sound = await storage.getSoundByFilename(testSound.filename);
      
      expect(sound).to.be.an('object');
      expect(sound.id).to.equal(createdSoundId);
      expect(sound.filename).to.equal(testSound.filename);
    });
    
    it('should check if sound title exists', async () => {
      const exists = await storage.soundTitleExists(testSound.name);
      expect(exists).to.equal(true);
      
      const nonexistentExists = await storage.soundTitleExists('Nonexistent Sound Title');
      expect(nonexistentExists).to.equal(false);
    });
  });
  
  // Edge Cases and Error Handling Tests
  describe('Edge Cases and Error Handling', () => {
    it('should handle nonexistent user ID gracefully', async () => {
      const nonexistentUser = await storage.updateAllowedUser(99999, { isAdmin: true });
      expect(nonexistentUser).to.be.undefined;
      
      const deletionResult = await storage.deleteAllowedUser(99999);
      expect(deletionResult).to.equal(false);
    });
    
    it('should handle nonexistent sound ID gracefully', async () => {
      const nonexistentSound = await storage.getSound(99999);
      expect(nonexistentSound).to.be.undefined;
      
      const deletionResult = await storage.deleteSound(99999);
      expect(deletionResult).to.equal(false);
    });
  });
});

if (require.main === module) {
  // Run tests directly if this file is executed directly
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}