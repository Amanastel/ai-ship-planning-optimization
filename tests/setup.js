// Test setup file

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Mock external dependencies
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
