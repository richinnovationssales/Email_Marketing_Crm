import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { EmployeeManagement } from '../../core/use-cases/client/EmployeeManagement';
import { EmployeeRepository } from '../../infrastructure/repositories/EmployeeRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import { EmployeeVerification } from '../../core/use-cases/client/EmployeeVerification';
import { EmailService } from '../../infrastructure/services/EmailService';
import { AuthService } from '../../infrastructure/services/AuthService';

const employeeRepository = new EmployeeRepository();
const emailService = new EmailService();
const authService = new AuthService();
const employeeManagementUseCase = new EmployeeManagement(employeeRepository);
const employeeVerificationUseCase = new EmployeeVerification(employeeRepository, emailService, authService);

export class EmployeeController {
  async createEmployee(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const employee = await employeeManagementUseCase.create(req.body, req.user.clientId);
      // After creating the employee, send a verification email
      await employeeVerificationUseCase.sendVerificationEmail(employee.id, req.user.clientId);
      res.status(StatusCodes.CREATED).json(employee);
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getEmployees(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const employees = await employeeManagementUseCase.findAll(req.user.clientId);
      res.json(employees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getEmployeeById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const employee = await employeeManagementUseCase.findById(req.params.id, req.user.clientId);
      if (!employee) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Employee not found' });
        return;
      }
      res.json(employee);
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateEmployee(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const employee = await employeeManagementUseCase.update(req.params.id, req.body, req.user.clientId);
      if (!employee) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Employee not found' });
        return;
      }
      res.json(employee);
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteEmployee(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const employee = await employeeManagementUseCase.delete(req.params.id, req.user.clientId);
      if (!employee) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Employee not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async resendVerificationEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { employeeId } = req.params;
      await employeeVerificationUseCase.sendVerificationEmail(employeeId, req.user.clientId);
      res.status(StatusCodes.OK).json({ message: 'Verification email sent' });
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async verifyEmployee(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;
      await employeeVerificationUseCase.verifyEmployee(token as string);
      res.status(StatusCodes.OK).send('<h1>Email verified successfully!</h1>');
    } catch (error) {
      console.error('Error verifying employee:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
