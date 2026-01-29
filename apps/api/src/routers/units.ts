import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const unitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.unit.findMany({
      include: { company: true },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      companyId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.unit.create({
        data: input,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      companyId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.unit.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.unit.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
