// src/presentation/routes/index.ts
import { Router } from 'express';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import userRoutes from './userRoutes';
import employeeRoutes from './employeeRoutes';
import planRoutes from './planRoutes';
import templateRoutes from './templateRoutes';
import contactRoutes from './contactRoutes';
import campaignRoutes from './campaignRoutes';
import groupRoutes from './groupRoutes';
import contactGroupRoutes from './contactGroupRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/employees', employeeRoutes);
router.use('/plans', planRoutes);
router.use('/templates', templateRoutes);
router.use('/contacts', contactRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/groups', groupRoutes);
router.use('/contact-groups', contactGroupRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;