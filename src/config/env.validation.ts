import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  HOST: Joi.string().default('0.0.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:5173'),
  APP_NAME: Joi.string().default('NestJS Boilerplate'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  // Database — required
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_SSL: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // JWT — required
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_DB: Joi.number().integer().min(0).default(0),

  // Email (Resend)
  RESEND_API_KEY: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().email().default('noreply@example.com'),

  // File uploads
  UPLOAD_DIR: Joi.string().default('uploads'),
  UPLOAD_MAX_SIZE_MB: Joi.number().integer().min(1).default(10),

  // Stripe — optional (all or nothing)
  STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
  STRIPE_PUBLISHABLE_KEY: Joi.string().optional().allow(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  STRIPE_SUCCESS_URL: Joi.string().uri().default('http://localhost:3000/payment/success'),
  STRIPE_CANCEL_URL: Joi.string().uri().default('http://localhost:3000/payment/cancel'),

  // Google OAuth — optional
  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/auth/google/callback'),

  // GitHub OAuth — optional
  GITHUB_CLIENT_ID: Joi.string().optional().allow(''),
  GITHUB_CLIENT_SECRET: Joi.string().optional().allow(''),
  GITHUB_CALLBACK_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/auth/github/callback'),

  // WebAuthn
  WEBAUTHN_RP_NAME: Joi.string().default('NestJS Boilerplate'),
  WEBAUTHN_RP_ID: Joi.string().default('localhost'),
  WEBAUTHN_ORIGIN: Joi.string().uri().default('http://localhost:3000'),

  // Admin panel — omit to disable the admin panel entirely
  ADMIN_COOKIE_SECRET: Joi.string().min(32).optional().allow(''),
}).options({ allowUnknown: true });
