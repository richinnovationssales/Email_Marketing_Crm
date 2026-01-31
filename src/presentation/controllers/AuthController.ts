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
import {
  AuthService,
  TokenPayload,
} from "../../infrastructure/services/AuthService";
import { AuthRequest } from "../middlewares/authMiddleware";
import prisma from "../../infrastructure/database/prisma";

const userRepository = new UserRepository();
const adminRepository = new AdminRepository();
const clientRepository = new ClientRepository();
const customFieldRepository = new CustomFieldRepository();
const authService = new AuthService();
const authUseCase = new Auth(userRepository);
const adminAuthUseCase = new AdminAuth(adminRepository);
const clientSelfRegistration = new ClientSelfRegistrationUseCase(
  clientRepository,
  userRepository,
  customFieldRepository,
);

export class AuthController {
  // User login - now returns access and refresh tokens
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Verify credentials
      const user = await userRepository.findByEmail(email);
      if (!user) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid credentials" });
        return;
      }

      const isValidPassword = await authService.comparePassword(
        password,
        user.password,
      );
      if (!isValidPassword) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid credentials" });
        return;
      }

      // Block unapproved or inactive clients
      if (user.client && (!user.client.isApproved || !user.client.isActive)) {
        res.status(StatusCodes.FORBIDDEN).json({
          message: "Client account is not active or not approved",
        });
        return;
      }

      // Generate token pair
      const payload: TokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        type: "user",
      };

      const tokens = await authService.generateTokenPair(payload);

      res.json({
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
          },
        },
      });
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
      const { email, password, isSuperAdmin = false } = req.body;

      // Verify admin credentials
      const admin = await adminRepository.findByEmail(email);
      if (!admin || !admin.password) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid credentials" });
        return;
      }

      const isValidPassword = await authService.comparePassword(
        password,
        admin.password,
      );
      if (!isValidPassword) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid credentials" });
        return;
      }

      // Check super admin access
      if (isSuperAdmin && admin.role !== "SUPER_ADMIN") {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Insufficient permissions for super admin access" });
        return;
      }

      // Generate token pair
      const payload: TokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: "admin",
      };

      const tokens = await authService.generateTokenPair(payload);

      res.json({
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          admin: {
            id: admin.id,
            email: admin.email,
            role: admin.role,
          },
        },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
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

  /**
   * Verify the current access token and return user data
   * GET /auth/verify
   */
  async verifyUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid token" });
        return;
      }

      // Get fresh user data from database
      let userData: any = null;

      // Check if it's a regular user or admin based on role
      const isAdmin =
        req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";

      if (isAdmin && !req.user.clientId) {
        // It's an admin
        const admin = await prisma.admin.findUnique({
          where: { id: req.user.id },
          select: { id: true, email: true, role: true, createdAt: true },
        });

        if (!admin) {
          res
            .status(StatusCodes.UNAUTHORIZED)
            .json({ message: "User not found" });
          return;
        }

        userData = { ...admin, type: "admin" };
      } else {
        // It's a regular user
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            role: true,
            clientId: true,
            createdAt: true,
            client: {
              select: {
                id: true,
                name: true,
                isApproved: true,
                isActive: true,
              },
            },
          },
        });

        if (!user) {
          res
            .status(StatusCodes.UNAUTHORIZED)
            .json({ message: "User not found" });
          return;
        }

        userData = { ...user, type: "user" };
      }

      res.json({
        success: true,
        data: userData,
      });
    } catch (error) {
      console.error("Verify user error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Refresh token required" });
        return;
      }

      // Verify refresh token
      const tokenData = await authService.verifyRefreshToken(refreshToken);
      if (!tokenData) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid or expired refresh token" });
        return;
      }

      // Get user/admin data
      let payload: TokenPayload;

      if (tokenData.userId) {
        const user = await prisma.user.findUnique({
          where: { id: tokenData.userId },
          include: { client: true },
        });

        if (!user) {
          res
            .status(StatusCodes.UNAUTHORIZED)
            .json({ message: "User not found" });
          return;
        }

        if (user.client && (!user.client.isApproved || !user.client.isActive)) {
          await authService.revokeAllUserTokens(user.id);
          res.status(StatusCodes.FORBIDDEN).json({
            message: "Client account is not active or not approved",
          });
          return;
        }

        payload = {
          id: user.id,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          type: "user",
        };
      } else if (tokenData.adminId) {
        const admin = await prisma.admin.findUnique({
          where: { id: tokenData.adminId },
          select: { id: true, email: true, role: true },
        });

        if (!admin) {
          res
            .status(StatusCodes.UNAUTHORIZED)
            .json({ message: "Admin not found" });
          return;
        }

        payload = {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          type: "admin",
        };
      } else {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Invalid token data" });
        return;
      }

      // Generate new access token only (keep same refresh token)
      const accessToken = await authService.generateAccessToken(payload);

      res.json({
        success: true,
        data: {
          accessToken,
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }

  /**
   * Logout - revoke refresh token
   * POST /auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Refresh token required" });
        return;
      }

      await authService.revokeRefreshToken(refreshToken);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  }
}
