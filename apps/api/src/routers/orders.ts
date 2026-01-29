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
      
      const stepsToCreate = input.selectedSteps || serviceType.steps.map((s, idx) => ({
        stepIdx: idx,
        items: [],
        dependency: undefined as any,
      }));

      for (let i = 0; i < stepsToCreate.length; i++) {
        const stepInput = stepsToCreate[i];
        const stepDef = serviceType.steps[stepInput.stepIdx] || { name: 'Geral', order: i };
        const isFirst = i === 0;
        
        let initialStatus: 'PENDENTE' | 'BLOQUEADO' = isFirst ? 'PENDENTE' : 'BLOQUEADO';
        const dependsOn = isFirst ? [] : [createdOrderIds[i - 1]];
        
        // Add external dependency if present
        if (stepInput.dependency && stepInput.dependency.type === 'BLOQUEADA') {
          initialStatus = 'BLOQUEADO';
          dependsOn.push(stepInput.dependency.actionId);
        }

        const order = await ctx.prisma.serviceOrder.create({
          data: {
            groupId,
            bedId: input.bedId,
            serviceTypeId: input.serviceTypeId,
            subServiceName: stepDef.name,
            step: stepDef.order,
            status: initialStatus,
            priority: input.priority,
            notes: input.notes,
            requestedById: ctx.userId!,
            assignedToTeamId: (stepDef as any).targetTeamId,
            dependsOnOrderIds: dependsOn,
            items: stepInput.items,
            history: [
              {
                status: initialStatus,
                userId: ctx.userId!,
                timestamp: new Date().toISOString(),
                note: isFirst ? 'Ordem criada' : 'Aguardando etapa anterior ou dependência externa',
              }
            ],
          },
        });
        
        createdOrderIds.push(order.id);
        orders.push(order);

        // Handle BLOQUEADOR dependency (blocking another order)
        if (stepInput.dependency && stepInput.dependency.type === 'BLOQUEADOR') {
          await ctx.prisma.serviceOrder.update({
            where: { id: stepInput.dependency.actionId },
            data: {
              status: 'BLOQUEADO',
              dependsOnOrderIds: {
                push: order.id
              },
              history: {
                push: {
                  status: 'BLOQUEADO',
                  userId: ctx.userId!,
                  timestamp: new Date().toISOString(),
                  note: `Bloqueado pela OS #${order.id.slice(-6)}`,
                }
              }
            }
          });
        }
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
      const order = await ctx.prisma.serviceOrder.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === 'CONCLUIDO' && { completedAt: new Date() }),
        },
        include: {
          bed: true,
          serviceType: true,
          actions: true,
        },
      });

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

      return order;
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
