module.exports = {
  apps: [
    {
      name: 'DMR4-Cerebro',
      script: './main.js',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'DMR4-Worker',
      script: './worker.js',
      instances: 'max', // Esto es tu "ReplicaSet" de K8s
      exec_mode: 'cluster'
    },
    {
      name: 'DMR4-API',
      script: './server.js'
    }
  ]
};
