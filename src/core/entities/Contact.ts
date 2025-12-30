export interface Contact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, any>;
  nameValueId?: string | null;
}


