import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { hash } from 'bcrypt';

/**
 * Users Router
 * Handles user management
 */
export const usersRouter = router({
  /**
   * List all users
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.findMany({
      include: {
        team: true,
      },
      orderBy: { name: 'asc' },
    });

    // Format users for frontend
    return users.map(({ passwordHash, role, teamId, ...userData }) => ({
      ...userData,
      permissions: {
        isAdmin: role === 'ADMIN',
        pages: [],
        modules: [],
      },
    }));
  }),

  /**
   * Get user by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        include: { team: true },
      });

      if (!user) return null;

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
   * Create user (admin only)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        cpf: z.string().regex(/^\d{11}$/),
        email: z.string().email().optional().nullable(),
        login: z.string().min(1).optional().nullable(),
        password: z.string().min(4),
        role: z.enum(['ADMIN', 'OPERACIONAL', 'VISUALIZADOR']),
        teamId: z.string().optional().nullable(),
        companyId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hash(input.password, 10);

      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          cpf: input.cpf,
          email: input.email,
          login: input.login,
          passwordHash,
          role: input.role,
          teamId: input.teamId,
          companyId: input.companyId,
        },
      });

      const { passwordHash: _, role, teamId, ...userData } = user;
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
   * Update user (admin only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        login: z.string().min(1).optional().nullable(),
        cpf: z.string().regex(/^\d{11}$/).optional(),
        password: z.string().min(4).optional(),
        role: z.enum(['ADMIN', 'OPERACIONAL', 'VISUALIZADOR']).optional(),
        teamId: z.string().optional().nullable(),
        companyId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;

      const updateData: any = { ...data };
      if (password) {
        updateData.passwordHash = await hash(password, 10);
      }

      const user = await ctx.prisma.user.update({
        where: { id },
        data: updateData,
      });

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
   * Delete user (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
