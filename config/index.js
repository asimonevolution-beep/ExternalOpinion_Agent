const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CARICO_ASTE_DIR: z.string().nonempty().default('CARICO_ASTE'),
  REPORT_FINALI_DIR: z.string().nonempty().default('REPORT_FINALI'),
  REGISTRO_ORE_FILE: z.string().nonempty().default('registro_attivita.txt'),
  LOG_FILE: z.string().nonempty().default('logs/external-opinion.log'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PDF_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  CASHFLOW_VALUE_PER_SQM: z.coerce.number().positive().default(1300),
  CASHFLOW_RENOVATION_COST_PER_SQM: z.coerce.number().positive().default(500),
  CASHFLOW_PROFIT_MARGIN: z.coerce.number().min(0).max(1).default(0.18),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TWILIO_SID: z.string().optional(),
  TWILIO_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  TWILIO_TO: z.string().optional(),
  WHATSAPP_NOTIFICATIONS_ENABLED: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

module.exports = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  watchDir: path.resolve(process.cwd(), env.CARICO_ASTE_DIR),
  reportDir: path.resolve(process.cwd(), env.REPORT_FINALI_DIR),
  registroOreFile: path.resolve(process.cwd(), env.REGISTRO_ORE_FILE),
  logFile: path.resolve(process.cwd(), env.LOG_FILE),
  logLevel: env.LOG_LEVEL,
  pdfTimeoutMs: env.PDF_DOWNLOAD_TIMEOUT_MS,
  cashflow: {
    valuePerSqm: env.CASHFLOW_VALUE_PER_SQM,
    renovationCostPerSqm: env.CASHFLOW_RENOVATION_COST_PER_SQM,
    profitMargin: env.CASHFLOW_PROFIT_MARGIN,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },
  twilio: {
    sid: env.TWILIO_SID,
    token: env.TWILIO_TOKEN,
    from: env.TWILIO_FROM,
    to: env.TWILIO_TO,
    enabled: env.WHATSAPP_NOTIFICATIONS_ENABLED,
  },
};
