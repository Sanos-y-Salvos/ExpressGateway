const axios = require('axios');

module.exports = {
  version: '1.0.0',
  policies: ['health-check'],
  init: function (pluginContext) {
    pluginContext.registerPolicy({
      name: 'health-check',
      // El esquema de la política DEBE contener el $id aquí dentro
      schema: {
        $id: 'http://express-gateway.io/schemas/policies/health-check.json',
        type: 'object',
        properties: {} // No requiere parámetros en el YAML
      },
      policy: (actionParams) => {
        return async (req, res) => {
          const servicios = [
            { name: 'ms-mascotas', url: 'http://ms-mascotas:3003/health' }, 
            { name: 'ms-localizacion', url: 'http://ms-localizacion:3004/health' }
          ];

          const statusReport = {};

          for (const service of servicios) {
            try {
              // Intenta pegarle a cada microservicio
              await axios.get(service.url, { timeout: 2000 });
              statusReport[service.name] = 'UP';
            } catch (error) {
              statusReport[service.name] = 'DOWN';
            }
          }

          res.json({ status: 'Gateway OK', services: statusReport });
        };
      }
    });
  }
};