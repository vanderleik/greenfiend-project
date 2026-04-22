import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),

  DB_TYPE: Joi.string().valid('postgres', 'sqlite').default('sqlite'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('postgres'),
  DB_NAME: Joi.string().default('greenfield'),
  DB_SYNCHRONIZE: Joi.boolean().default(true),

  JWT_ACCESS_SECRET: Joi.string()
    .min(16)
    .default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(16)
    .default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().positive().default(7),

  EMAIL_VERIFY_TOKEN_TTL_HOURS: Joi.number().integer().positive().default(24),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(30),

  MAIL_FROM: Joi.string().email().default('no-reply@greenfield.local'),
  MAIL_TRANSPORT: Joi.string().valid('json', 'smtp').default('json'),
  MAIL_HOST: Joi.string().when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MAIL_PORT: Joi.number().when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASSWORD: Joi.string().allow('').optional(),

  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
});
