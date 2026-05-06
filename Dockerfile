# 1. Usamos Alpine: es la versión más rápida y segura para trading
FROM node:18-alpine

# 2. Creamos el directorio de trabajo
WORKDIR /app

# 3. Optimizamos la instalación de dependencias (Caché inteligente)
# Esto evita que 'npm install' corra innecesariamente si no cambias librerías
COPY package*.json ./
RUN npm install --production

# 4. Copiamos el resto del código
COPY . .

# 5. El comando por defecto (se sobrescribe por cada servicio en el docker-compose)
CMD ["node", "controlPlane.js"]

