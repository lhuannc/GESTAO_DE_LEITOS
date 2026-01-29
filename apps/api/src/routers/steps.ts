import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const stepsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.step.findMany({
      include: { serviceType: true },
      orderBy: [
        { name: 'asc' }
      ],
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      order: z.number().int().default(0),
      targetTeamId: z.string().optional().nullable(),
      slaMinutes: z.number().int().optional().nullable(),
      allowedItemIds: z.array(z.string()).default([]),
      serviceTypeId: z.string().optional().nullable(),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = {
        ...input,
        serviceTypeId: input.serviceTypeId ?? undefined,
        description: input.description ?? undefined,
        targetTeamId: input.targetTeamId ?? undefined,
        slaMinutes: input.slaMinutes ?? undefined,
        companyId: input.companyId ?? undefined,
      };
      return ctx.prisma.step.create({
        data: data as any,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      order: z.number().int().optional(),
      targetTeamId: z.string().optional().nullable(),
      slaMinutes: z.number().int().optional().nullable(),
      allowedItemIds: z.array(z.string()).optional(),
      serviceTypeId: z.string().optional().nullable(),
      companyId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...inputData } = input;
      const data = {
        ...inputData,
        serviceTypeId: inputData.serviceTypeId ?? undefined,
        description: inputData.description ?? undefined,
        targetTeamId: inputData.targetTeamId ?? undefined,
        slaMinutes: inputData.slaMinutes ?? undefined,
        companyId: inputData.companyId ?? undefined,
      };
      return ctx.prisma.step.update({
        where: { id },
        data: data as any,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.step.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
