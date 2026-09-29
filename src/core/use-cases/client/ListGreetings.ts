import { GreetingRepository } from '../../../infrastructure/repositories/GreetingRepository';
import { Greeting } from '../../entities/Greeting';

export class ListGreetings {
  constructor(private greetingRepository: GreetingRepository) {}

  async execute(): Promise<Greeting[]> {
    return this.greetingRepository.findAll(false);
  }
}
