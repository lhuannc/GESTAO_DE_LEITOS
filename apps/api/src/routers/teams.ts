import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

/**
 * Teams Router
 * Handles team management
 */
export const teamsRouter = router({
  /**
   * List all teams
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const teams = await ctx.prisma.team.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            cpf: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format teams for frontend (userIds array)
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      companyId: team.companyId || '',
      userIds: team.users.map((u) => u.id),
    }));
  }),

  /**
   * Get team by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.id },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              cpf: true,
            },
          },
        },
      });

      if (!team) return null;

      return {
        id: team.id,
        name: team.name,
        companyId: team.companyId || '',
        userIds: team.users.map((u) => u.id),
      };
    }),

  /**
   * Create team (admin only)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        companyId: z.string().optional().nullable(),
        userIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userIds, ...data } = input;
      const team = await ctx.prisma.team.create({
        data: {
          ...data,
          users: userIds ? {
            connect: userIds.map(id => ({ id }))
          } : undefined
        },
        include: {
          users: true,
        },
      });

      return {
        id: team.id,
        name: team.name,
        companyId: team.companyId || '',
        userIds: team.users.map((u) => u.id),
      };
    }),

  /**
   * Update team (admin only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        companyId: z.string().optional().nullable(),
        userIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, userIds, ...data } = input;
      const team = await ctx.prisma.team.update({
        where: { id },
        data: {
          ...data,
          users: userIds ? {
            set: userIds.map(id => ({ id }))
          } : undefined
        },
        include: {
          users: true,
        },
      });

      return {
        id: team.id,
        name: team.name,
        companyId: team.companyId || '',
        userIds: team.users.map((u) => u.id),
      };
    }),

  /**
   * Delete team (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.team.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
