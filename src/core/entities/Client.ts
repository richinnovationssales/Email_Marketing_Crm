import { Plan } from './Plan';

export interface Client {
    id: string;
    name: string;
    isApproved: boolean;
    plan: Plan;
    planId: string;
    planStartDate?: Date | null;
    planRenewalDate?: Date | null;
    remainingMessages?: number | null;
    createdAt: Date;
    updatedAt: Date;
}
