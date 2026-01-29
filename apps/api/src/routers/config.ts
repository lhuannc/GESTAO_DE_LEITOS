import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const configRouter = router({
  // Bed Status Configs
  listBedStatusConfigs: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.bedStatusConfig.findMany({
      orderBy: { name: 'asc' },
    });
  }),

  createBedStatusConfig: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().min(1),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.bedStatusConfig.create({
        data: input,
      });
    }),

  updateBedStatusConfig: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.bedStatusConfig.update({
        where: { id },
        data,
      });
    }),

  deleteBedStatusConfig: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.bedStatusConfig.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  // Complement Items
  listComplementItems: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.complementItem.findMany({
      orderBy: { name: 'asc' },
    });
  }),

  createComplementItem: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      unitCost: z.number().default(0),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.complementItem.create({
        data: input,
      });
    }),

  updateComplementItem: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      unitCost: z.number().optional(),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.complementItem.update({
        where: { id },
        data,
      });
    }),

  deleteComplementItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.complementItem.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
