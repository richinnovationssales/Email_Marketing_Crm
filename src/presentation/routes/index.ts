// src/presentation/routes/index.ts
import { Router } from 'express';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import userRoutes from './userRoutes';
import planRoutes from './planRoutes';
import templateRoutes from './templateRoutes';
import contactRoutes from './contactRoutes';
import campaignRoutes from './campaignRoutes';
import groupRoutes from './groupRoutes';
import contactGroupRoutes from './contactGroupRoutes';
import dashboardRoutes from './dashboardRoutes';
import customFieldRoutes from './customFieldRoutes';
import webhookRoutes from './webhookRoutes';
import analyticsRoutes from './analyticsRoutes';
import clientDomainRoutes from './clientDomainRoutes';

const router = Router();

// Public routes (no auth required)
router.use('/webhooks', webhookRoutes);

// Auth routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/plans', planRoutes);
router.use('/templates', templateRoutes);
router.use('/contacts', contactRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/groups', groupRoutes);
router.use('/contact-groups', contactGroupRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/custom-fields', customFieldRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/client/domain', clientDomainRoutes);

export default router;
