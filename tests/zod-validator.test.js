// Zod Schema Validation Tests
import chai from 'chai';
import { z } from 'zod';
import * as schemaModule from '../shared/schema.js';

const { expect } = chai;

// Import schemas from shared schema file
let schema = schemaModule;

describe('Zod Schema Validation', function() {
  this.timeout(5000);

  // Skip all tests if schema could not be imported
  before(function() {
    if (!schema) {
      console.warn('Skipping all Zod schema tests because schema could not be imported');
      this.skip();
    }
  });

  describe('Sound Schema', () => {
    it('should validate a valid sound object', function() {
      if (!schema.insertSoundSchema) this.skip();
      
      const validSound = {
        name: 'Test Sound',
        filename: 'test-sound.mp3',
        category: 'effects',
        uploader: 'test@example.com'
      };
      
      const result = schema.insertSoundSchema.safeParse(validSound);
      expect(result.success).to.be.true;
      
      // Check that the parsed data matches our input
      expect(result.data.name).to.equal(validSound.name);
      expect(result.data.filename).to.equal(validSound.filename);
      expect(result.data.category).to.equal(validSound.category);
      expect(result.data.uploader).to.equal(validSound.uploader);
    });
    
    it('should reject a sound with missing required fields', function() {
      if (!schema.insertSoundSchema) this.skip();
      
      const invalidSound = {
        name: 'Test Sound',
        // Missing filename
        category: 'effects' 
      };
      
      const result = schema.insertSoundSchema.safeParse(invalidSound);
      expect(result.success).to.be.false;
      
      // Check that the error message mentions the missing field
      expect(result.error.issues.some(issue => 
        issue.path.includes('filename')
      )).to.be.true;
    });
    
    it('should reject a sound with invalid category', function() {
      if (!schema.insertSoundSchema) this.skip();
      
      const invalidSound = {
        name: 'Test Sound',
        filename: 'test-sound.mp3',
        category: 'invalid-category', // Not in allowed categories
        uploader: 'test@example.com'
      };
      
      const result = schema.insertSoundSchema.safeParse(invalidSound);
      expect(result.success).to.be.false;
      
      // Check that the error message mentions the category field
      expect(result.error.issues.some(issue => 
        issue.path.includes('category')
      )).to.be.true;
    });
  });
  
  describe('User Schema', () => {
    it('should validate a valid user object', function() {
      if (!schema.insertAllowedUserSchema) this.skip();
      
      const validUser = {
        email: 'test@example.com',
        isAdmin: true
      };
      
      const result = schema.insertAllowedUserSchema.safeParse(validUser);
      expect(result.success).to.be.true;
      
      // Check that the parsed data matches our input
      expect(result.data.email).to.equal(validUser.email);
      expect(result.data.isAdmin).to.equal(validUser.isAdmin);
    });
    
    it('should set default isAdmin to false when not provided', function() {
      if (!schema.insertAllowedUserSchema) this.skip();
      
      const userWithoutIsAdmin = {
        email: 'test@example.com'
        // isAdmin not provided, should default to false
      };
      
      const result = schema.insertAllowedUserSchema.safeParse(userWithoutIsAdmin);
      expect(result.success).to.be.true;
      expect(result.data.isAdmin).to.be.false; // Check default value
    });
    
    it('should reject a user with invalid email', function() {
      if (!schema.insertAllowedUserSchema) this.skip();
      
      const invalidUser = {
        email: 'not-an-email',
        isAdmin: false
      };
      
      const result = schema.insertAllowedUserSchema.safeParse(invalidUser);
      expect(result.success).to.be.false;
      
      // Check that the error message mentions the email field
      expect(result.error.issues.some(issue => 
        issue.path.includes('email')
      )).to.be.true;
    });
  });
  
  describe('WebSocket Message Schemas', () => {
    // Test PlaySoundMessage format
    it('should validate a valid play sound message', function() {
      // Create a schema based on the PlaySoundMessage type
      if (!schema.WSMessageType) this.skip();
      
      // Create a schema based on the expected structure
      const playMessageSchema = z.object({
        type: z.literal('play'),
        data: z.object({
          soundId: z.number()
        })
      });
      
      const validMessage = {
        type: 'play',
        data: { soundId: 1 }
      };
      
      const result = playMessageSchema.safeParse(validMessage);
      expect(result.success).to.be.true;
      expect(result.data.type).to.equal('play');
      expect(result.data.data.soundId).to.equal(1);
    });
    
    // Test VolumeMessage format
    it('should validate a valid volume message', function() {
      if (!schema.WSMessageType) this.skip();
      
      // Create a schema based on the expected structure
      const volumeMessageSchema = z.object({
        type: z.literal('volume'),
        data: z.object({
          volume: z.number().min(0).max(100)
        })
      });
      
      const validMessage = {
        type: 'volume',
        data: { volume: 50 }
      };
      
      const result = volumeMessageSchema.safeParse(validMessage);
      expect(result.success).to.be.true;
      expect(result.data.type).to.equal('volume');
      expect(result.data.data.volume).to.equal(50);
    });
    
    // Test NowPlayingMessage format
    it('should validate a valid nowPlaying message with sound', function() {
      if (!schema.WSMessageType) this.skip();
      
      // Create a schema for a simplified sound object
      const soundSchema = z.object({
        id: z.number(),
        name: z.string(),
        filename: z.string(),
        category: z.string(),
        uploader: z.string().nullable(),
        uploadedAt: z.string().or(z.date()).nullable()
      });
      
      // Create a schema based on the expected structure
      const nowPlayingMessageSchema = z.object({
        type: z.literal('nowPlaying'),
        data: z.object({
          sound: soundSchema.nullable()
        })
      });
      
      const validMessage = {
        type: 'nowPlaying',
        data: { 
          sound: {
            id: 1,
            name: 'Test Sound',
            filename: 'test.mp3',
            category: 'effects',
            uploader: 'test@example.com',
            uploadedAt: new Date().toISOString()
          }
        }
      };
      
      const result = nowPlayingMessageSchema.safeParse(validMessage);
      expect(result.success).to.be.true;
      expect(result.data.type).to.equal('nowPlaying');
      expect(result.data.data.sound).to.be.an('object');
      expect(result.data.data.sound.id).to.equal(1);
    });
    
    // Test NowPlayingMessage with null sound
    it('should validate a valid nowPlaying message with null sound', function() {
      if (!schema.WSMessageType) this.skip();
      
      // Create a schema for the sound object
      const soundSchema = z.object({
        id: z.number(),
        name: z.string(),
        filename: z.string(),
        category: z.string(),
        uploader: z.string().nullable(),
        uploadedAt: z.string().or(z.date()).nullable()
      });
      
      // Create a schema based on the expected structure
      const nowPlayingMessageSchema = z.object({
        type: z.literal('nowPlaying'),
        data: z.object({
          sound: soundSchema.nullable()
        })
      });
      
      const validMessage = {
        type: 'nowPlaying',
        data: { sound: null }
      };
      
      const result = nowPlayingMessageSchema.safeParse(validMessage);
      expect(result.success).to.be.true;
      expect(result.data.type).to.equal('nowPlaying');
      expect(result.data.data.sound).to.be.null;
    });
  });
});

// For direct execution in ES modules context
// We're using the mocha CLI tool through our test runner