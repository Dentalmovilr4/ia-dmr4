const axios = require('axios');

const API = process.env.DMR4_API || 'http://localhost:3000/api/ai/execute';
const KEY = process.env.DMR4_API_KEY || 'dmr4-secret';

async function ejecutar(action, repo) {
  try {
    const res = await axios.post(API,
      { action, repo },
      { headers: { 'x-api-key': KEY } }
    );

    return res.data;

  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { ejecutar };