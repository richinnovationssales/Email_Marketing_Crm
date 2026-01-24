// src/index.ts
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import routes from './presentation/routes';
import { CampaignScheduler } from './infrastructure/services/CampaignScheduler';
import { CampaignRepository } from './infrastructure/repositories/CampaignRepository';
import { ContactGroupRepository } from './infrastructure/repositories/ContactGroupRepository';
import { EmailService } from './infrastructure/services/EmailService';
import Logger from './infrastructure/logging/logger';
import errorHandler from './presentation/middlewares/errorHandler';
import prisma from './infrastructure/database/prisma';
import { SendCampaign } from './core/use-cases/client/SendCampaign';

const app = express();
const port = process.env.PORT || 3000;

// Morgan stream for Winston
const stream = {
  write: (message: string) => Logger.http(message.trim()),
};

app.use(morgan('tiny', { stream }));
app.use(cors({
  origin: [
    '{
  "name": "email-marketing-crm-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "eslint"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.2",
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.4",
    "@reduxjs/toolkit": "^2.5.0",
    "@tanstack/react-query": "^5.62.12",
    "@tanstack/react-table": "^8.20.6",
    "@tiptap/react": "^3.15.1",
    "@tiptap/starter-kit": "^3.15.1",
    "@types/js-cookie": "^3.0.6",
    "axios": "^1.7.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "grapesjs": "^0.22.14",
    "grapesjs-mjml": "^1.0.7",
    "js-cookie": "^3.0.5",
    "lucide-react": "^0.469.0",
    "next": "16.0.8",
    "next-themes": "^0.4.6",
    "react": "19.2.1",
    "react-day-picker": "^9.13.0",
    "react-dom": "19.2.1",
    "react-dropzone": "^14.3.5",
    "react-hook-form": "^7.68.0",
    "react-redux": "^9.2.0",
    "react-split": "^2.0.14",
    "react-split-pane": "^2.0.3",
    "recharts": "^2.15.4",
    "sonner": "^1.7.4",
    "tailwind-merge": "^2.6.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.0.8",
    "tailwindcss": "^4",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5"
  }
}
'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api', routes);

// Centralized Error Handler
app.use(errorHandler);

const campaignRepository = new CampaignRepository();
const contactGroupRepository = new ContactGroupRepository();
const emailService = new EmailService();

// Initialize MailgunService if enabled
import { MailgunService } from './infrastructure/services/MailgunService';
let mailgunService: MailgunService | undefined;
try {
  if (process.env.USE_MAILGUN === 'true') {
    mailgunService = new MailgunService();
    Logger.info('MailgunService initialized for scheduler');
  }
} catch (error) {
  Logger.warn('Failed to initialize MailgunService for scheduler:', error);
}

const sendCampaignUseCase = new SendCampaign(
  campaignRepository, 
  contactGroupRepository, 
  emailService,
  mailgunService
);
const campaignScheduler = new CampaignScheduler(sendCampaignUseCase, campaignRepository);

campaignScheduler.start();

const server = app.listen(port, () => {
  Logger.info(`Server is running on port : ${port}`);
});

const gracefulShutdown = (signal: string) => {
  Logger.warn(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    Logger.info('HTTP server closed.');
    await prisma.$disconnect();
    Logger.info('Database connection closed.');
    campaignScheduler.stop();
    Logger.info('Campaign scheduler stopped.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

