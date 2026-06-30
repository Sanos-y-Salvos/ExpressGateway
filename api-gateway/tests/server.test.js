'use strict';

describe('server.js', () => {
  it('sets EG_CONFIG_DIR and calls gateway().load().run()', () => {
    jest.resetModules();

    const mockRun = jest.fn();
    const mockLoad = jest.fn().mockReturnValue({ run: mockRun });
    const mockGateway = jest.fn().mockReturnValue({ load: mockLoad });

    jest.mock('express-gateway', () => mockGateway);

    require('../server');

    expect(process.env.EG_CONFIG_DIR).toContain('config');
    expect(mockGateway).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
