export interface Template {
  id: string;
  name: string;
  subject: string;
  content: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDTO {
  name: string;
  subject: string;
  content: string;
}


export interface UpdateTemplateDTO {
  name?: string;
  subject?: string;
  content?: string;
}
