// setup.ts - Jest test setup file

import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup database connection for testing
beforeAll(async () => {
  try {
    // Use in-memory MongoDB for testing or test database
    const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/cricket_test';
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    process.exit(1);
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
  }
});

// Clean up after each test
afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('Failed to cleanup collections:', error);
  }
});

// Increase timeout for database operations
jest.setTimeout(30000);