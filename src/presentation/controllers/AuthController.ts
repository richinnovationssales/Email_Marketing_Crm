// src/presentation/controllers/AuthController.ts
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Auth } from "../../core/use-cases/Auth";
import { AdminAuth } from "../../core/use-cases/auth/AdminAuth";
import { ClientSelfRegistrationUseCase } from "../../core/use-cases/auth/ClientSelfRegistrationUseCase";
import { UserRepository } from "../../infrastructure/repositories/UserRepository";
import { AdminRepository } from "../../infrastructure/repositories/AdminRepository";
import { ClientRepository } from "../../infrastructure/repositories/ClientRepository";
import { CustomFieldRepository } from "../../infrastructure/repositories/CustomFieldRepository";

const userRepository = new UserRepository();
const adminRepository = new AdminRepository();
const clientRepository = new ClientRepository();
const customFieldRepository = new CustomFieldRepository();
const authUseCase = new Auth(userRepository);
const adminAuthUseCase = new AdminAuth(adminRepository);
const clientSelfRegistration = new ClientSelfRegistrationUseCase(
  clientRepository,
  userRepository,
  customFieldRepository
);

export class AuthController {
  // User login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const token = await authUseCase.login(email, password);

      if (!token) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid credentials" });
        return;
      }

      res.json({ data: token });
    } catch (error) {
      console.error("Login error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }

  // User registration
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, clientId, role } = req.body;
      const token = await authUseCase.register(email, password, clientId, role);

      if (!token) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Registration failed" });
        return;
      }

      res.status(StatusCodes.CREATED).json({ token });
    } catch (error) {
      console.error("Registration error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }

  // Admin login (unified for both SUPER_ADMIN and ADMIN)
  async adminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const token = await adminAuthUseCase.login(email, password);

      if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          message: "Invalid credentials or insufficient permissions",
        });
        return;
      }

      res.json({ data: token });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Internal server error",
      });
    }
  }

  async registerClient(req: Request, res: Response): Promise<void> {
    try {
      const client = await clientSelfRegistration.execute(req.body);
      res.status(StatusCodes.CREATED).json({
        message: "Client registration successful. Awaiting admin approval.",
        client: {
          id: client.id,
          name: client.name,
          isApproved: client.isApproved,
        },
      });
    } catch (error: any) {
      console.error("Client registration error:", error);

      if (
        error.message === "Client with this name already exists" ||
        error.message === "User with this email already exists"
      ) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
        return;
      }

      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }
}
