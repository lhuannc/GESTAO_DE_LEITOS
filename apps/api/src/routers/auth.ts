import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { compare } from 'bcrypt';
import { signToken, getCookieOptions } from '../utils/jwt';

/**
 * Authentication Router
 */
export const authRouter = router({
  /**
   * Login with CPF and password
   */
  login: publicProcedure
    .input(
      z.object({
        cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find user by CPF
      const user = await ctx.prisma.user.findUnique({
        where: { cpf: input.cpf },
        include: {
          team: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'CPF ou senha inválidos',
        });
      }

      // Verify password
      const isValid = await compare(input.password, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'CPF ou senha inválidos',
        });
      }

      // Generate JWT token
      const token = signToken({
        userId: user.id,
        role: user.role,
      });

      // Set HttpOnly cookie with JWT
      // In production (HTTPS), cookie will have Secure flag automatically
      ctx.res.setCookie('token', token, getCookieOptions());

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          changes: undefined, // No changes for login
        },
      });

      // Return user without password, formatted for frontend
      const { passwordHash, role, teamId, ...userData } = user;

      const formattedUser = {
        ...userData,
        permissions: {
          isAdmin: role === 'ADMIN',
          pages: [], // TODO: Implement page permissions
          modules: [], // TODO: Implement module permissions
        },
      };

      return {
        user: formattedUser,
        // Token is in HttpOnly cookie, not returned in response
      };
    }),

  /**
   * Get current user
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId! },
      include: {
        team: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      });
    }

    const { passwordHash, role, teamId, ...userData } = user;
    
    return {
      ...userData,
      permissions: {
        isAdmin: role === 'ADMIN',
        pages: [],
        modules: [],
      },
    };
  }),

  /**
   * Logout
   * Clears the JWT cookie
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Clear the JWT cookie
    ctx.res.clearCookie('token', {
      path: '/',
    });

    // Create audit log if user was authenticated
    if (ctx.userId) {
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: 'LOGOUT',
          entity: 'User',
          entityId: ctx.userId,
          changes: undefined, // No changes for logout
        },
      });
    }

    return { success: true };
  }),
});
