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
  
  // OpenAlex
  openAlex: {
    apiUrl: process.env.OPENALEX_API_URL || 'https://api.openalex.org',
    email: process.env.OPENALEX_EMAIL || '',
    maxResults: parseInt(process.env.OPENALEX_MAX_RESULTS || '10', 10),
  },
  
  // Paper Fetching
  paper: {
    fetchIntervalHours: parseInt(process.env.FETCH_INTERVAL_HOURS || '24', 10),
    defaultTopics: (process.env.DEFAULT_TOPICS || 'artificial intelligence,machine learning,natural language processing').split(','),
    minCitationCount: parseInt(process.env.MIN_CITATION_COUNT || '10', 10),
  },
  
  // GitHub Copilot SDK
  // The SDK auto-reads GITHUB_TOKEN, but we expose it here for validation.
  github: {
    token: process.env.GITHUB_TOKEN || '',
    // Model to use for summarisation. gpt-4.1 is available on all Copilot plans.
    model: process.env.COPILOT_MODEL || 'gpt-4.1',
  },

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

export default config;
