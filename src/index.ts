// src/index.ts
import express from 'express';
import morgan from 'morgan';
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
app.use(express.json());
app.use('/api', routes);

// Centralized Error Handler
app.use(errorHandler);

const campaignRepository = new CampaignRepository();
const contactGroupRepository = new ContactGroupRepository();
const emailService = new EmailService();
const sendCampaignUseCase = new SendCampaign(campaignRepository, contactGroupRepository, emailService);
const campaignScheduler = new CampaignScheduler(sendCampaignUseCase, campaignRepository);

campaignScheduler.start();

const server = app.listen(port, () => {
  Logger.info(`Server is running on port ${port}`);
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

