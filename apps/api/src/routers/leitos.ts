import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

/**
 * Leitos (Beds) Router
 * Handles all bed-related operations
 */
export const leitosRouter = router({
  /**
   * List all beds with optional filters
   */
  list: protectedProcedure
    .input(
      z.object({
        sectorId: z.string().optional(),
        status: z.enum(['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BLOQUEADO']).optional(),
      }).nullish()
    )
    .query(async ({ ctx, input }) => {
      const beds = await ctx.prisma.bed.findMany({
        where: {
          ...(input?.sectorId && { sectorId: input.sectorId }),
          ...(input?.status && { status: input.status }),
        },
        include: {
          sector: {
            include: {
              unit: {
                include: {
                  company: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      return beds;
    }),

  /**
   * Get bed by ID with full details
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bed = await ctx.prisma.bed.findUnique({
        where: { id: input.id },
        include: {
          sector: {
            include: {
              unit: {
                include: {
                  company: true,
                },
              },
            },
          },
          serviceOrders: {
            include: {
              serviceType: true,
              requestedBy: true,
              assignedTo: true,
              actions: {
                include: {
                  step: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
          bedHistory: {
            orderBy: {
              changedAt: 'desc',
            },
            take: 20,
          },
        },
      });

      if (!bed) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Leito não encontrado',
        });
      }

      return bed;
    }),

  /**
   * Update bed status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BLOQUEADO']),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update bed
      const bed = await ctx.prisma.bed.update({
        where: { id: input.id },
        data: { status: input.status },
        include: {
          sector: {
            include: {
              unit: {
                include: {
                  company: true,
                },
              },
            },
          },
        },
      });

      // Create history entry
      await ctx.prisma.bedHistory.create({
        data: {
          bedId: input.id,
          status: input.status,
          notes: input.notes,
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId!,
          action: 'UPDATE_BED_STATUS',
          entity: 'Bed',
          entityId: input.id,
          changes: {
            status: input.status,
            notes: input.notes,
          },
        },
      });

      return bed;
    }),

  /**
   * Create bed (admin only)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        sectorId: z.string(),
        status: z.enum(['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BLOQUEADO']).default('DISPONIVEL'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bed = await ctx.prisma.bed.create({
        data: {
          name: input.name,
          sectorId: input.sectorId,
          status: input.status,
        },
      });

      return bed;
    }),

  /**
   * Update bed general info (admin only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        sectorId: z.string().optional(),
        status: z.enum(['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BLOQUEADO']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const bed = await ctx.prisma.bed.update({
        where: { id },
        data,
      });

      return bed;
    }),

  /**
   * Delete bed (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.bed.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Get bed statistics by sector
   */
  stats: protectedProcedure
    .input(z.object({ sectorId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = input.sectorId ? { sectorId: input.sectorId } : {};

      const [total, disponivel, ocupado, higienizacao, manutencao] = await Promise.all([
        ctx.prisma.bed.count({ where }),
        ctx.prisma.bed.count({ where: { ...where, status: 'DISPONIVEL' } }),
        ctx.prisma.bed.count({ where: { ...where, status: 'OCUPADO' } }),
        ctx.prisma.bed.count({ where: { ...where, status: 'HIGIENIZACAO' } }),
        ctx.prisma.bed.count({ where: { ...where, status: 'MANUTENCAO' } }),
      ]);

      return {
        total,
        disponivel,
        ocupado,
        higienizacao,
        manutencao,
        taxa_ocupacao: total > 0 ? (ocupado / total) * 100 : 0,
      };
    }),
});
