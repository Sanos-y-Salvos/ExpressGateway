// api-gateway/plugins/circuit-breaker/index.js
const CircuitBreaker = require('opossum');
const axios = require('axios');

// 1. Configuración del Circuit Breaker
const breakerOptions = {
  timeout: 5000, // Si el microservicio tarda más de 5s, se considera fallo
  errorThresholdPercentage: 50, // Si falla el 50% de las peticiones, abre el circuito
  resetTimeout: 15000 // Espera 15s en circuito abierto antes de intentar probar de nuevo
};

// 2. Función que ejecuta la llamada real al microservicio
const makeRequest = async (req, targetUrl) => {
  const response = await axios({
    method: req.method,
    url: `${targetUrl}${req.url}`,
    headers: req.headers, // Aquí viaja el x-user-id inyectado previamente
    data: req.body,
    validateStatus: () => true // Evita que Axios lance excepciones con errores 400/500 legítimos
  });
  return response;
};

// 3. Instanciamos Opossum
const breaker = new CircuitBreaker(makeRequest, breakerOptions);

// 4. Qué responder cuando el microservicio está caído (Fallback)
breaker.fallback(() => {
  throw new Error('El microservicio no responde. Circuito abierto de protección.');
});

// 5. Exportamos el plugin para Express Gateway
module.exports = {
  version: '1.0.0',
  policies: ['circuit-breaker'],
  init: function (pluginContext) {
    pluginContext.registerPolicy({
      name: 'circuit-breaker',
      policy: (actionParams) => {
        return async (req, res, next) => {
          try {
            // Disparamos la petición a través de Opossum
            const result = await breaker.fire(req, actionParams.serviceUrl);
            
            // Replicamos la respuesta del microservicio hacia el frontend
            res.set(result.headers);
            res.status(result.status).send(result.data);
          } catch (err) {
            // Si entra aquí, es porque Opossum abortó la petición (Timeout o Abierto)
            res.status(503).json({
              error: 'Service Unavailable',
              message: err.message
            });
          }
        };
      }
    });
  }
};