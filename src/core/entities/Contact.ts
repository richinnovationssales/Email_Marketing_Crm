export interface Contact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}


