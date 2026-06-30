'use strict';

// Mocks must be established before the plugin is required so Jest never
// tries to transform the real opossum (which uses ESM syntax in v9).
jest.mock('opossum');
jest.mock('axios');

const CircuitBreaker = require('opossum');
const axios = require('axios');

// Build the breaker mock once; every instantiation returns this same object.
const mockBreakerInstance = {
  fallback: jest.fn(),
  fire: jest.fn(),
};
CircuitBreaker.mockImplementation((fn) => {
  // Expose the internal makeRequest function for direct testing.
  mockBreakerInstance.__makeRequest = fn;
  return mockBreakerInstance;
});

// Load the plugin once (top-level require is fine because mocks are already in place).
const plugin = require('../plugins/circuit-breaker/index');

let registeredPolicy = null;
const pluginContext = {
  registerPolicy: jest.fn((p) => { registeredPolicy = p; }),
};
plugin.init(pluginContext);

// ── module-level assertions ───────────────────────────────────────────────────

describe('circuit-breaker plugin — module', () => {
  it('exports version 1.0.0', () => {
    expect(plugin.version).toBe('1.0.0');
  });

  it('exports policies array containing "circuit-breaker"', () => {
    expect(plugin.policies).toContain('circuit-breaker');
  });

  it('registers the circuit-breaker policy via init()', () => {
    expect(pluginContext.registerPolicy).toHaveBeenCalled();
    expect(registeredPolicy.name).toBe('circuit-breaker');
  });

  it('attaches a fallback to the breaker', () => {
    expect(mockBreakerInstance.fallback).toHaveBeenCalledWith(expect.any(Function));
  });

  it('fallback throws with circuit-open message', () => {
    const fallbackFn = mockBreakerInstance.fallback.mock.calls[0][0];
    expect(() => fallbackFn()).toThrow('El microservicio no responde');
  });
});

// ── makeRequest (internal, passed to CircuitBreaker constructor) ──────────────

describe('circuit-breaker plugin — makeRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls axios with method, composed url, headers and body', async () => {
    axios.mockResolvedValue({ status: 200, headers: {}, data: 'ok' });

    const fakeReq = {
      method: 'POST',
      url: '/reportes',
      headers: { 'x-user-id': '42' },
      body: { nombre: 'Luna' },
    };
    await mockBreakerInstance.__makeRequest(fakeReq, 'http://ms-mascotas:3003');

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: 'http://ms-mascotas:3003/reportes',
      headers: fakeReq.headers,
      data: fakeReq.body,
    }));
  });

  it('validateStatus always returns true (avoids axios error throws)', async () => {
    axios.mockResolvedValue({ status: 404, headers: {}, data: 'not found' });

    const fakeReq = { method: 'GET', url: '/x', headers: {}, body: {} };
    await mockBreakerInstance.__makeRequest(fakeReq, 'http://svc:9000');

    const { validateStatus } = axios.mock.calls[0][0];
    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(500)).toBe(true);
    expect(validateStatus(404)).toBe(true);
  });
});

// ── policy middleware ─────────────────────────────────────────────────────────

describe('circuit-breaker plugin — policy middleware', () => {
  const serviceUrl = 'http://ms-mascotas:3003';
  let middleware;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = registeredPolicy.policy({ serviceUrl });
    req = { method: 'GET', url: '/reportes', headers: {}, body: {} };
    res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('fires the breaker and proxies a successful upstream response', async () => {
    const upstream = { headers: { 'content-type': 'application/json' }, status: 201, data: { id: 1 } };
    mockBreakerInstance.fire.mockResolvedValue(upstream);

    await middleware(req, res, jest.fn());

    expect(mockBreakerInstance.fire).toHaveBeenCalledWith(req, serviceUrl);
    expect(res.set).toHaveBeenCalledWith(upstream.headers);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(upstream.data);
  });

  it('returns 503 when the breaker throws (circuit open or timeout)', async () => {
    mockBreakerInstance.fire.mockRejectedValue(new Error('Circuit open'));

    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Service Unavailable',
      message: 'Circuit open',
    }));
  });
});
