export enum AdminRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN'
}

export interface Admin {
    id: string;
    email: string;
    password?: string;
    role: AdminRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
