// src/core/entities/User.ts

import { UserRole } from '@prisma/client';
import { Client } from './Client'; 

export class User {
  constructor(
    public id: string,
    public email: string,
    public password: string,
    public role: UserRole,
    public clientId: string,
    public createdAt: Date,
    public updatedAt: Date,
    public client?: {
      id : string;
      isApproved : boolean;
      isActive : boolean;
    }
  ) { }
}
