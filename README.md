# API Gateway — Sanos y Salvos

Puerta de entrada de todo el tráfico HTTP del frontend. Aplica CORS, rate limiting, verificación JWT y circuit breaker antes de reenviar las peticiones al BFF.

Basado en **express-gateway**.

**Puerto:** `8080`

> El frontend usa `VITE_API_GATEWAY_URL` (por defecto `http://localhost:8000`). Ajusta esa variable a `http://localhost:8080` para que apunte al gateway.

---

## Instalación y ejecución

```bash
# Desarrollo
npm install
npm start

# Docker
docker compose up -d --build
```

---

## Pipelines y políticas

### `mascotas_publico_pipeline`

- **Rutas:** `GET /api/mascotas/reportes`, `OPTIONS /api/mascotas/reportes`
- **Políticas:** CORS → rate-limit → proxy al BFF
- Sin verificación JWT. Permite listar reportes sin estar autenticado.

### `localizacion_pipeline`

- **Rutas:** `GET /api/localizacion/*`, `OPTIONS /api/localizacion/*`
- **Políticas:** CORS → rate-limit → proxy al BFF
- Sin verificación JWT. Permite consultar el mapa sin autenticación.

### Pipeline general (resto de rutas)

- **Rutas:** todo lo demás bajo `/api/*`
- **Políticas:** CORS → rate-limit → JWT verify → proxy al BFF
- El gateway inyecta `x-user-id` y `x-user-role` en las peticiones que superan la verificación JWT. Estos headers son propagados por el BFF a cada microservicio.

---

## Configuración

Archivo principal: `config/gateway.config.yml`

> **IMPORTANTE:** `JWT_SECRET` está **hardcodeado** en `gateway.config.yml`. Debe coincidir exactamente con el valor de `JWT_SECRET` en `ms-auth`, `ms-users` y `ms-mensajeria-privada`. Actualiza este archivo cada vez que cambie el secreto.

---

## Flujo de una petición autenticada

```
Frontend
  └─► Gateway :8080   [CORS → rate-limit → JWT → inyecta x-user-id / x-user-role]
        └─► BFF :3000 [proxy al microservicio correspondiente]
              └─► Microservicio
```
