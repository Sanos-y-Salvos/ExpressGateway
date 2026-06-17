# Usamos la versión de Node que tienes instalada
FROM node:22-alpine

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos primero los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos los puertos
EXPOSE 8080 9876

# El comando para arrancar
CMD ["node", "server.js"]