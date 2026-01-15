import { GroupRepository } from '../../../infrastructure/repositories/GroupRepository';
import { Group } from '../../entities/Group';

export class GroupManagement {
  constructor(private groupRepository: GroupRepository) { }

  async create(data: Group, clientId: string, userId: string): Promise<Group> {
    return this.groupRepository.create(data, clientId, userId);
  }

  async findAll(clientId: string): Promise<Group[]> {
    return this.groupRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Group | null> {
    return this.groupRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Group>, clientId: string): Promise<Group | null> {
    return this.groupRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Group | null> {
    return this.groupRepository.delete(id, clientId);
  }
}
