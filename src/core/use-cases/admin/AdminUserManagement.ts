import { Admin, AdminRole } from "../../entities/Admin";
import { AdminRepository } from "../../../infrastructure/repositories/AdminRepository";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { Client } from "src/core/entities/Client";

export class AdminUserManagement {
  [x: string]: any;
  constructor(private adminRepository: AdminRepository) {}

  async create(
    data: Prisma.AdminCreateInput,
    requesterRole: AdminRole
  ): Promise<Admin> {
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can create admins");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const adminData = {
      ...data,
      password: hashedPassword,
      role: AdminRole.ADMIN,
    };
    return this.adminRepository.create(adminData);
  }

  async findAll(requesterRole: AdminRole): Promise<Admin[]> {
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can list admins");
    }
    return this.adminRepository.findAll();
  }

  async delete(id: string, requesterRole: AdminRole): Promise<Admin | null> {
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can delete admins");
    }
    return this.adminRepository.delete(id);
  }

  async onboardClient(
    adminId: string,
    requesterRole: AdminRole,
    dto: {
      name: string;
      planId: string;
      planStartDate?: Date;
      remainingMessages?: number;
    }
  ): Promise<Client> {
    // 1. Authorization check
    if (requesterRole !== AdminRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can onboard clients");
    }

    // 2. Ensure admin exists
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const now = new Date();
    const planStart = dto.planStartDate ?? now;

    // Renewal date example: 30 days later (customize as needed)
    const planRenewalDate = new Date(planStart);
    planRenewalDate.setDate(planRenewalDate.getDate() + 30);

    // 3. Create Client
    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        planId: dto.planId,
        planStartDate: planStart,
        planRenewalDate,
        remainingMessages: dto.remainingMessages ?? 0,
        isApproved: false, // default onboarding state
        isActive: true,
      },
    });

    return client;
  }
}
