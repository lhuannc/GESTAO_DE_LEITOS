import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

/**
 * Services Router
 * Handles service types (Higienização, Manutenção, etc.)
 */
export const servicesRouter = router({
  /**
   * List all service types
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const services = await ctx.prisma.serviceType.findMany({
      orderBy: { name: 'asc' },
    });
    return services;
  }),

  /**
   * Get service by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = await ctx.prisma.serviceType.findUnique({
        where: { id: input.id },
      });
      return service;
    }),

  /**
   * Create service type (admin only)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        generateMultipleOS: z.boolean().default(false),
        config: z.any().optional(),
        companyId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = await ctx.prisma.serviceType.create({
        data: {
          name: input.name,
          description: input.description,
          generateMultipleOS: input.generateMultipleOS,
          config: input.config || {},
          companyId: input.companyId,
        },
      });

      return service;
    }),

  /**
   * Update service type (admin only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        generateMultipleOS: z.boolean().optional(),
        config: z.any().optional(),
        companyId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const service = await ctx.prisma.serviceType.update({
        where: { id },
        data,
      });

      return service;
    }),

  /**
   * Delete service type (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.serviceType.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
