import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Discord
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  
  // Database
  database: {
    path: process.env.DATABASE_PATH || './data/research-agent.db',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
  
  // arXiv
  arxiv: {
    apiUrl: process.env.ARXIV_API_URL || 'http://export.arxiv.org/api/query',
    maxResults: parseInt(process.env.ARXIV_MAX_RESULTS || '10', 10),
  },
  
  // Paper Fetching
  paper: {
    fetchIntervalHours: parseInt(process.env.FETCH_INTERVAL_HOURS || '24', 10),
    defaultDomains: (process.env.DEFAULT_DOMAINS || 'cs.AI,cs.LG,cs.CL').split(','),
  },
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

export default config;
