import { GreetingRepository } from '../../../infrastructure/repositories/GreetingRepository';
import { Greeting } from '../../entities/Greeting';
import { findInvalidGreetingTokens, GREETING_TOKENS } from '../../constants/greetingTokens';

export interface CreateGreetingInput {
  name: string;
  template: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateGreetingInput {
  name?: string;
  template?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export class GreetingTemplateValidationError extends Error {
  constructor(public invalidTokens: string[]) {
    super(
      `Invalid greeting tokens: ${invalidTokens.map((t) => `{{${t}}}`).join(', ')}. ` +
        `Allowed tokens: ${GREETING_TOKENS.map((t) => `{{${t}}}`).join(', ')}`
    );
    this.name = 'GreetingTemplateValidationError';
  }
}

export class GreetingManagement {
  constructor(private greetingRepository: GreetingRepository) {}

  private assertValidTemplate(template: string): void {
    const invalid = findInvalidGreetingTokens(template);
    if (invalid.length > 0) {
      throw new GreetingTemplateValidationError(invalid);
    }
  }

  async create(data: CreateGreetingInput): Promise<Greeting> {
    this.assertValidTemplate(data.template);
    return this.greetingRepository.create({
      name: data.name,
      template: data.template,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
    });
  }

  async findAll(includeInactive: boolean = false): Promise<Greeting[]> {
    return this.greetingRepository.findAll(includeInactive);
  }

  async findById(id: string): Promise<Greeting | null> {
    return this.greetingRepository.findById(id);
  }

  async update(id: string, data: UpdateGreetingInput): Promise<Greeting | null> {
    if (data.template !== undefined) {
      this.assertValidTemplate(data.template);
    }
    return this.greetingRepository.update(id, data);
  }

  async delete(id: string): Promise<Greeting | null> {
    return this.greetingRepository.delete(id);
  }
}
