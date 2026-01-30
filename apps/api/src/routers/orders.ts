import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

/**
 * Service Orders Router
 */
export const ordersRouter = router({
  /**
   * List service orders with filters
   */
  list: protectedProcedure
    .input(
      z.object({
        bedId: z.string().optional(),
        status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO', 'BLOQUEADO']).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).nullish()
    )
    .query(async ({ ctx, input }) => {
      const orders = await ctx.prisma.serviceOrder.findMany({
        where: {
          ...(input?.bedId && { bedId: input.bedId }),
          ...(input?.status && { status: input.status }),
        },
        include: {
          bed: {
            include: {
              sector: {
                include: {
                  unit: {
                    include: {
                      company: true
                    }
                  },
                },
              },
            },
          },
          serviceType: {
            include: {
              steps: true
            }
          },
          requestedBy: true,
          assignedToTeam: true,
          assignedToUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input?.limit ?? 50,
      });

      return orders;
    }),

  /**
   * Create new service flow (multiple orders)
   */
  create: protectedProcedure
    .input(
      z.object({
        bedId: z.string(),
        serviceTypeId: z.string(),
        priority: z.number().min(0).max(10).default(0),
        notes: z.string().optional(),
        selectedSteps: z.array(z.object({
          stepIdx: z.number(),
          items: z.array(z.object({
            itemId: z.string(),
            name: z.string(),
            quantity: z.number(),
            unitCost: z.number(),
          })),
          dependency: z.object({
            bedId: z.string(),
            flowId: z.string(),
            actionId: z.string(),
            type: z.enum(['BLOQUEADA', 'BLOQUEADOR']),
          }).optional(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bed = await ctx.prisma.bed.findUnique({ where: { id: input.bedId } });
      if (!bed) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leito não encontrado' });

      const serviceType = await ctx.prisma.serviceType.findUnique({
        where: { id: input.serviceTypeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      if (!serviceType) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tipo de serviço não encontrado' });

      const groupId = `grp_${Math.random().toString(36).substr(2, 9)}`;
      const orders = [];
      const createdOrderIds: string[] = [];
      
      // Determine configuration from config field or related steps
      const config = (serviceType as any).config || {};
      const subOrders = config.subOrders || (serviceType.steps as any[]).map((s, idx) => ({
        stepId: s.id,
        name: s.name,
        targetTeamId: s.targetTeamId,
        allowedItemIds: s.allowedItemIds,
      }));

      const stepsToCreate = input.selectedSteps || subOrders.map((s: any, idx: number) => ({
        stepIdx: idx,
        items: [],
        dependency: undefined,
      }));

      for (let i = 0; i < stepsToCreate.length; i++) {
        const stepInput = stepsToCreate[i];
        const stepConfig = subOrders[stepInput.stepIdx];
        
        if (!stepConfig) continue;

        const isFirst = i === 0;
        let initialStatus: 'PENDENTE' | 'BLOQUEADO' = isFirst ? 'PENDENTE' : 'BLOQUEADO';
        const dependsOn = isFirst ? [] : [createdOrderIds[i - 1]];

        // Create the order
        const order = await ctx.prisma.serviceOrder.create({
          data: {
            groupId,
            bedId: input.bedId,
            serviceTypeId: input.serviceTypeId,
            subServiceName: stepConfig.name || 'Geral',
            step: i,
            status: initialStatus,
            priority: input.priority,
            notes: input.notes,
            requestedById: ctx.userId!,
            assignedToTeamId: stepConfig.targetTeamId,
            dependsOnOrderIds: dependsOn,
            items: stepInput.items,
            history: [
              {
                status: initialStatus,
                userId: ctx.userId!,
                timestamp: new Date().toISOString(),
                note: isFirst ? 'Ordem criada' : 'Aguardando etapa anterior',
              }
            ],
          },
        });

        // Update bed status if it's the first step and has an initial status
        if (isFirst && stepConfig.bedStatusConfig?.onStart) {
          await ctx.prisma.bed.update({
            where: { id: input.bedId },
            data: { status: stepConfig.bedStatusConfig.onStart },
          });
        }
        
        createdOrderIds.push(order.id);
        orders.push(order);
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId!,
          action: 'CREATE_SERVICE_FLOW_FULL',
          entity: 'ServiceOrderGroup',
          entityId: groupId,
          changes: { bedId: input.bedId, serviceTypeId: input.serviceTypeId, steps: orders.length },
        },
      });

      return orders[0];
    }),

  /**
   * Update order status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO', 'BLOQUEADO']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.serviceOrder.findUnique({
        where: { id: input.id },
        include: { serviceType: true },
      });

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem não encontrada' });
      }

      // Update the order status
      const updatedOrder = await ctx.prisma.serviceOrder.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === 'CONCLUIDO' && { completedAt: new Date() }),
          history: {
            push: {
              status: input.status,
              userId: ctx.userId!,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      // Update bed status if status transitions are defined in config
      const serviceType = order.serviceType as any;

      if (serviceType?.config) {
        const config = serviceType.config as any;
        const stepConfig = config.subOrders?.[order.step];
        if (stepConfig) {
          if (input.status === 'EM_ANDAMENTO' && stepConfig.bedStatusConfig?.onStart) {
            await ctx.prisma.bed.update({
              where: { id: order.bedId },
              data: { status: stepConfig.bedStatusConfig.onStart },
            });
          } else if (input.status === 'CONCLUIDO' && stepConfig.bedStatusConfig?.onFinish) {
            await ctx.prisma.bed.update({
              where: { id: order.bedId },
              data: { status: stepConfig.bedStatusConfig.onFinish },
            });
          }
        }
      }

      // If finished, release next step
      if (input.status === 'CONCLUIDO') {
        const nextOrder = await ctx.prisma.serviceOrder.findFirst({
          where: {
            groupId: order.groupId,
            step: order.step + 1,
            status: 'BLOQUEADO',
          },
        });

        if (nextOrder) {
          await ctx.prisma.serviceOrder.update({
            where: { id: nextOrder.id },
            data: {
              status: 'PENDENTE',
              history: {
                push: {
                  status: 'PENDENTE',
                  userId: 'system',
                  timestamp: new Date().toISOString(),
                  note: 'Liberado automaticamente após conclusão da etapa anterior',
                },
              },
            },
          });
        }
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId!,
          action: 'UPDATE_ORDER_STATUS',
          entity: 'ServiceOrder',
          entityId: input.id,
          changes: { status: input.status },
        },
      });

      return updatedOrder;
    }),

  /**
   * Assign order to current user
   */
  assign: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.serviceOrder.update({
        where: { id: input.id },
        data: {
          assignedToUserId: ctx.userId!,
          status: 'EM_ANDAMENTO',
          history: {
            push: {
              status: 'EM_ANDAMENTO',
              userId: ctx.userId!,
              timestamp: new Date().toISOString(),
              note: 'Atribuído via Kanban',
            },
          },
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId!,
          action: 'ASSIGN_ORDER',
          entity: 'ServiceOrder',
          entityId: input.id,
          changes: { assignedToUserId: ctx.userId! },
        },
      });

      return order;
    }),

  /**
   * Unassign order
   */
  unassign: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.serviceOrder.update({
        where: { id: input.id },
        data: {
          assignedToUserId: null,
          status: 'PENDENTE',
          history: {
            push: {
              status: 'PENDENTE',
              userId: ctx.userId!,
              timestamp: new Date().toISOString(),
              note: 'Responsável removido',
            },
          },
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId!,
          action: 'UNASSIGN_ORDER',
          entity: 'ServiceOrder',
          entityId: input.id,
          changes: { assignedToUserId: null },
        },
      });

      return order;
    }),
});
