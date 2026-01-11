// src/core/use-cases/auth/AdminAuth.ts
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { AdminRepository } from "../../../infrastructure/repositories/AdminRepository";
import { AdminRole } from "../../entities/Admin";

export class AdminAuth {
  constructor(private adminRepository: AdminRepository) {}

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: any } | null> {
    // 1. Find admin by email ONLY
    const admin = await this.adminRepository.findByEmail(email);

    if (!admin || !admin.password) {
      return null;
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return null;
    }

    // 3. Allow only valid admin roles
    if (
      admin.role !== AdminRole.ADMIN &&
      admin.role !== AdminRole.SUPER_ADMIN
    ) {
      return null;
    }

    // 4. Generate token with role from DB
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );

    const { password: _password, ...safeAdmin } = admin;

    return {
      token,
      user: safeAdmin,
    };
  }

  async createAdmin(email: string, password: string, role: AdminRole) {
    const hashedPassword = await bcrypt.hash(password, 10);

    return await this.adminRepository.create({
      email,
      password: hashedPassword,
      role,
    });
  }
}
