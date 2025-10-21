import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  gatewayApiKey: process.env.GATEWAY_API_KEY,
  gatewayWebhookSecret: process.env.GATEWAY_WEBHOOK_SECRET,
  baseUrl: process.env.BASE_URL || 'http://localhost:4000'
};

export default config;
