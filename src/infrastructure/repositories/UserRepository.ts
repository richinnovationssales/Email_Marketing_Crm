// src/infrastructure/repositories/UserRepository.ts
import { User } from "../../core/entities/User";
import prisma from "../../infrastructure/database/prisma";
import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

export interface UserCreationData {
  email: string;
  password: string;
  clientId: string;
  role?: UserRole;
}

export class UserRepository {
  async create(data: UserCreationData): Promise<User> {
    // @ts-ignore
    return await prisma.user.create({ data });
  }

  async findAll(clientId?: string): Promise<User[]> {
    const where = clientId ? { clientId } : {};
    return await prisma.user.findMany({ where });
  }

  async findById(id: string, clientId?: string): Promise<User | null> {
    const where = clientId ? { id, clientId } : { id };
    // @ts-ignore
    return await prisma.user.findFirst({ where });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        client: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput,
    clientId?: string,
  ): Promise<User | null> {
    const where = clientId ? { id, clientId } : { id };
    // @ts-ignore
    const user = await prisma.user.findFirst({ where });
    if (!user) {
      return null;
    }
    return await prisma.user.update({ where: { id }, data });
  }

  async delete(id: string, clientId?: string): Promise<User | null> {
    const where = clientId ? { id, clientId } : { id };
    // @ts-ignore
    const user = await prisma.user.findFirst({ where });
    if (!user) {
      return null;
    }
    return await prisma.user.delete({ where: { id } });
  }
}
