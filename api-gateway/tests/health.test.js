'use strict';

jest.mock('axios');

describe('health-check plugin', () => {
  let pluginContext;
  let registeredPolicy;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('axios');

    registeredPolicy = null;
    pluginContext = {
      registerPolicy: jest.fn((p) => { registeredPolicy = p; }),
    };

    require('../plugins/health/index').init(pluginContext);
  });

  it('registers the health-check policy', () => {
    expect(pluginContext.registerPolicy).toHaveBeenCalled();
    expect(registeredPolicy.name).toBe('health-check');
  });

  it('exports correct version and policies array', () => {
    const plugin = require('../plugins/health/index');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.policies).toContain('health-check');
  });

  it('schema has the required $id field', () => {
    expect(registeredPolicy.schema).toBeDefined();
    expect(registeredPolicy.schema.$id).toContain('health-check');
  });

  describe('health-check middleware', () => {
    let middleware;
    let req;
    let res;

    beforeEach(() => {
      middleware = registeredPolicy.policy({});
      req = {};
      res = { json: jest.fn() };
    });

    it('marks services UP when they respond successfully', async () => {
      const axios = require('axios');
      axios.get = jest.fn().mockResolvedValue({ status: 200 });

      await middleware(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'Gateway OK',
        services: expect.objectContaining({
          'ms-mascotas': 'UP',
          'ms-localizacion': 'UP',
        }),
      }));
    });

    it('marks services DOWN when they throw', async () => {
      const axios = require('axios');
      axios.get = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await middleware(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'Gateway OK',
        services: expect.objectContaining({
          'ms-mascotas': 'DOWN',
          'ms-localizacion': 'DOWN',
        }),
      }));
    });

    it('handles mixed UP/DOWN results', async () => {
      const axios = require('axios');
      axios.get = jest.fn()
        .mockResolvedValueOnce({ status: 200 })       // ms-mascotas → UP
        .mockRejectedValueOnce(new Error('timeout'));   // ms-localizacion → DOWN

      await middleware(req, res);

      const { services } = res.json.mock.calls[0][0];
      expect(services['ms-mascotas']).toBe('UP');
      expect(services['ms-localizacion']).toBe('DOWN');
    });
  });
});
