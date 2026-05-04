const fs=require('fs');function w(f,c){fs.writeFileSync(f,c);console.log("✔",f)}

// =====================
// docker-compose.yml
// =====================
w('docker-compose.yml',`
version: '3.9'

services:

  redis:
    image: redis:7
    restart: always
    ports:
      - "6379:6379"

  api:
    build: .
    command: node api.js
    restart: always
    env_file: .env
    ports:
      - "3001:3001"
    depends_on:
      - redis

  scheduler:
    build: .
    command: node scheduler.js
    restart: always
    env_file: .env
    depends_on:
      - redis

  failover:
    build: .
    command: node failover.js
    restart: always
    env_file: .env
    depends_on:
      - redis

  worker1:
    build: .
    command: node worker.js
    restart: always
    env_file: .env
    environment:
      - NODE_ID=node1
      - REGION=us-east

  worker2:
    build: .
    command: node worker.js
    restart: always
    env_file: .env
    environment:
      - NODE_ID=node2
      - REGION=eu-west

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - api
`);

// =====================
// Dockerfile
// =====================
w('Dockerfile',`
FROM node:18

WORKDIR /app
COPY . .

RUN npm install

CMD ["node","api.js"]
`);

// =====================
// nginx.conf
// =====================
w('nginx.conf',`
events {}

http {
  server {
    listen 80;

    location / {
      proxy_pass http://api:3001;
    }
  }
}
`);

// =====================
// .env
// =====================
w('.env',`
REDIS_URL=redis://redis:6379
BASE_DIR=/app
NODE_ID=node1
REGION=us-east
`);

// =====================
// package.json
// =====================
w('package.json',`
{
  "name":"dmr4-cloud",
  "version":"1.0.0",
  "main":"api.js",
  "dependencies":{
    "ioredis":"^5.3.2",
    "express":"^4.18.2",
    "dotenv":"^16.4.5"
  }
}
`);

console.log("\\n🚀 PRODUCCIÓN LISTA");
