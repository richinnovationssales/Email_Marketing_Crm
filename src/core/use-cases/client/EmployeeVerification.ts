import { EmployeeRepository } from '../../../infrastructure/repositories/EmployeeRepository';
import { EmailService } from '../../../infrastructure/services/EmailService';
import { AuthService } from '../../../infrastructure/services/AuthService';

export class EmployeeVerification {
  constructor(
    private employeeRepository: EmployeeRepository,
    private emailService: EmailService,
    private authService: AuthService
  ) { }

  async sendVerificationEmail(employeeId: string, clientId: string): Promise<void> {
    const employee = await this.employeeRepository.findById(employeeId, clientId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // In a real application, you would generate a unique token for verification.
    // For simplicity, we'll just use a JWT.
    const token = await this.authService.generateToken({ employeeId, clientId, scope: 'employee-verification' });
    const verificationLink = `http://localhost:3000/api/employees/verify?token=${token}`;

    await this.emailService.sendMail(
      employee.email,
      'Verify your email address',
      `<p>Please click this link to verify your email address: <a href="${verificationLink}">${verificationLink}</a></p>`
    );
  }

  async verifyEmployee(token: string): Promise<void> {
    const decoded = await this.authService.verifyToken(token);
    if (decoded.scope !== 'employee-verification') {
      throw new Error('Invalid token scope');
    }

    const { employeeId, clientId } = decoded;
    await this.employeeRepository.update(employeeId, { isVerified: true }, clientId);
  }
}
