import { EmployeeRepository } from '../../../infrastructure/repositories/EmployeeRepository';
import { Employee } from '../../entities/Employee';

export class EmployeeManagement {
  constructor(private employeeRepository: EmployeeRepository) { }

  async create(data: Employee, clientId: string): Promise<Employee> {
    return this.employeeRepository.create(data, clientId);
  }

  async findAll(clientId: string): Promise<Employee[]> {
    return this.employeeRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Employee | null> {
    return this.employeeRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Employee>, clientId: string): Promise<Employee | null> {
    return this.employeeRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Employee | null> {
    return this.employeeRepository.delete(id, clientId);
  }
}
