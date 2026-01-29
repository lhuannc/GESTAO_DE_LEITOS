import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const sectorsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.sector.findMany({
      include: { unit: { include: { company: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      unitId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sector.create({
        data: input,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      unitId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.sector.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.sector.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
