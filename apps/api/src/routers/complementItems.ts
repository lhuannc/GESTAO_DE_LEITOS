
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const complementItemsRouter = router({
    list: protectedProcedure
        .input(z.object({
            activeOnly: z.boolean().default(true).optional(),
        }).nullish())
        .query(async ({ ctx, input }) => {
            // For now, listing all. In future could filter by active if schema supported it.
            const items = await ctx.prisma.complementItem.findMany({
                orderBy: {
                    name: 'asc'
                }
            });
            return items;
        }),
});
