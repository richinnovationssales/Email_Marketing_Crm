import { Employee } from '../../core/entities/Employee';
import prisma from '../../infrastructure/database/prisma';

export class EmployeeRepository {
  async create(data: Employee, clientId: string): Promise<Employee> {
    return await prisma.employee.create({ data: { ...data, clientId } });
  }

  async findAll(clientId: string): Promise<Employee[]> {
    return await prisma.employee.findMany({ where: { clientId } });
  }

  async findById(id: string, clientId: string): Promise<Employee | null> {
    return await prisma.employee.findFirst({ where: { id, clientId } });
  }

  async update(id: string, data: Partial<Employee>, clientId: string): Promise<Employee | null> {
    // First, verify the employee belongs to the client
    const employee = await prisma.employee.findFirst({ where: { id, clientId } });
    if (!employee) {
      return null;
    }
    return await prisma.employee.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Employee | null> {
    // First, verify the employee belongs to the client
    const employee = await prisma.employee.findFirst({ where: { id, clientId } });
    if (!employee) {
      return null;
    }
    return await prisma.employee.delete({ where: { id } });
  }
}
