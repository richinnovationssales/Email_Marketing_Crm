
// import { UserRole } from '@prisma/client';

import { UserRole } from '@prisma/client';

export class User {
  constructor(
    public id: string,
    public email: string,
    public password: string,
    public role: UserRole,
    public clientId: string,
    public createdAt: Date,
    public updatedAt: Date
  ) { }
}
