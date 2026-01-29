import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const companiesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      cnpj: z.string().min(14),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.company.create({
        data: input,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      cnpj: z.string().min(14).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.company.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.company.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
