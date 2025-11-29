export interface SuperAdmin {
  id: string;
  email: string;
  password?: string; // Password should be optional as it will be stripped out in some cases
  createdAt: Date;
  updatedAt: Date;
}
