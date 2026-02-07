import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';

/**
 * Reasons Router
 * Manages reasons for cancellations and SLA overdue justifications
 */
export const reasonsRouter = router({
  /**
   * List reasons with optional filtering by rule
   */
  list: protectedProcedure
    .input(z.object({
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user.companyId) {
        throw new Error('Usuário não possui empresa associada');
      }

      const where: any = {
        companyId: ctx.user.companyId,
      };

      if (input?.rule) {
        where.rule = input.rule;
      }

      return await ctx.prisma.reason.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    }),

  /**
   * Create a new reason (admin only)
   */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.companyId) {
        throw new Error('Usuário não possui empresa associada');
      }

      return await ctx.prisma.reason.create({
        data: {
          name: input.name,
          rule: input.rule,
          companyId: ctx.user.companyId,
        },
      });
    }),

  /**
   * Update an existing reason (admin only)
   */
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.companyId) {
        throw new Error('Usuário não possui empresa associada');
      }

      // Verify the reason belongs to the user's company
      const reason = await ctx.prisma.reason.findFirst({
        where: {
          id: input.id,
          companyId: ctx.user.companyId,
        },
      });

      if (!reason) {
        throw new Error('Motivo não encontrado');
      }

      return await ctx.prisma.reason.update({
        where: { id: input.id },
        data: {
          name: input.name,
          rule: input.rule,
        },
      });
    }),

  /**
   * Delete a reason (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.companyId) {
        throw new Error('Usuário não possui empresa associada');
      }

      // Verify the reason belongs to the user's company
      const reason = await ctx.prisma.reason.findFirst({
        where: {
          id: input.id,
          companyId: ctx.user.companyId,
        },
      });

      if (!reason) {
        throw new Error('Motivo não encontrado');
      }

      // Check if the reason is being used
      const cancellationCount = await ctx.prisma.cancellationRecord.count({
        where: { reasonId: input.id },
      });

      const slaOverdueCount = await ctx.prisma.sLAOverdueRecord.count({
        where: { reasonId: input.id },
      });

      if (cancellationCount > 0 || slaOverdueCount > 0) {
        throw new Error('Não é possível excluir motivo que está sendo utilizado');
      }

      await ctx.prisma.reason.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
