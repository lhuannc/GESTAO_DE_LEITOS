import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';

export const sectionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      sectorId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {
        companyId: ctx.user.companyId,
      };

      if (input?.sectorId) {
        where.sectorId = input.sectorId;
      }

      return await ctx.prisma.section.findMany({
        where,
        include: {
          sector: true,
          _count: {
            select: { beds: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.section.create({
        data: {
          name: input.name,
          sectorId: input.sectorId,
          companyId: ctx.user.companyId,
        },
        include: {
          sector: true,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se a seção pertence à empresa do usuário
      const section = await ctx.prisma.section.findFirst({
        where: {
          id: input.id,
          companyId: ctx.user.companyId,
        },
      });

      if (!section) {
        throw new Error('Seção não encontrada');
      }

      return await ctx.prisma.section.update({
        where: { id: input.id },
        data: {
          name: input.name,
          sectorId: input.sectorId,
        },
        include: {
          sector: true,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se há leitos associados
      const bedsCount = await ctx.prisma.bed.count({
        where: { sectionId: input.id },
      });

      if (bedsCount > 0) {
        throw new Error('Não é possível excluir seção com leitos associados');
      }

      // Verificar se a seção pertence à empresa do usuário
      const section = await ctx.prisma.section.findFirst({
        where: {
          id: input.id,
          companyId: ctx.user.companyId,
        },
      });

      if (!section) {
        throw new Error('Seção não encontrada');
      }

      await ctx.prisma.section.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
