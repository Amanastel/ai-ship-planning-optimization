// Mock mongoose for testing
const mockSchema = {
  index: jest.fn(),
  pre: jest.fn(),
  post: jest.fn()
};

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    close: jest.fn().mockResolvedValue({})
  },
  model: jest.fn().mockReturnValue({}),
  Schema: jest.fn().mockImplementation(() => mockSchema)
}));

const request = require('supertest');
const app = require('../src/server');

describe('API Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });
});

describe('Root Endpoint', () => {
  test('GET / should return API information', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.body).toHaveProperty('message', 'AI-Powered Ship Planning & Optimization System');
    expect(response.body).toHaveProperty('version', '1.0.0');
    expect(response.body).toHaveProperty('endpoints');
  });
});

describe('Voyage Planning API', () => {
  test('POST /api/v1/voyages/plan-voyage should validate required fields', async () => {
    const response = await request(app)
      .post('/api/v1/voyages/plan-voyage')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toContain('Missing required fields');
  });

  test('GET /api/v1/voyages/plan-history should return voyage history', async () => {
    const response = await request(app)
      .get('/api/v1/voyages/plan-history')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('voyages');
    expect(response.body.data).toHaveProperty('pagination');
  });
});

describe('Maintenance API', () => {
  test('GET /api/v1/maintenance/alerts should return maintenance alerts', async () => {
    const response = await request(app)
      .get('/api/v1/maintenance/alerts')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('alerts');
    expect(response.body.data).toHaveProperty('summary');
  });
});

describe('Ship Management API', () => {
  test('GET /api/v1/ships should return ships list', async () => {
    const response = await request(app)
      .get('/api/v1/ships')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('ships');
    expect(response.body.data).toHaveProperty('pagination');
  });

  test('GET /api/v1/ships/analytics/fleet should return fleet analytics', async () => {
    const response = await request(app)
      .get('/api/v1/ships/analytics/fleet')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('analytics');
  });
});

describe('Error Handling', () => {
  test('404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent')
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Route not found');
  });
});
