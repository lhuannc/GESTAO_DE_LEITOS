import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

/**
 * Custom error classes for the API
 * All errors extend TRPCError for proper tRPC integration
 */

/**
 * Base class for domain-specific errors
 */
export class DomainError extends TRPCError {
  constructor(message: string, code: TRPCError['code'] = 'BAD_REQUEST') {
    super({ code, message });
    this.name = this.constructor.name;
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends TRPCError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} com ID '${id}' não encontrado`
      : `${resource} não encontrado`;
    super({ code: 'NOT_FOUND', message });
    this.name = 'NotFoundError';
  }
}

export class BedNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Leito', id);
  }
}

export class OrderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Ordem de serviço', id);
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Usuário', id);
  }
}

export class ServiceTypeNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Tipo de serviço', id);
  }
}

export class TeamNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Equipe', id);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends TRPCError {
  constructor(message: string, field?: string) {
    const fullMessage = field ? `${field}: ${message}` : message;
    super({ code: 'BAD_REQUEST', message: fullMessage });
    this.name = 'ValidationError';
  }
}

export class InvalidCPFError extends ValidationError {
  constructor() {
    super('CPF inválido', 'cpf');
  }
}

export class InvalidStatusTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(`Transição de status inválida: ${from} -> ${to}`);
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends TRPCError {
  constructor(message: string) {
    super({ code: 'BAD_REQUEST', message });
    this.name = 'BusinessLogicError';
  }
}

export class OrderBlockedError extends BusinessLogicError {
  constructor(orderId: string, blockedBy: string[]) {
    const message = blockedBy.length === 1
      ? `Ordem bloqueada pela ordem ${blockedBy[0]}`
      : `Ordem bloqueada por ${blockedBy.length} ordens: ${blockedBy.join(', ')}`;
    super(message);
  }
}

export class BedOccupiedError extends BusinessLogicError {
  constructor(bedName: string) {
    super(`Leito ${bedName} está ocupado e não pode ser modificado`);
  }
}

export class DuplicateOrderError extends BusinessLogicError {
  constructor(bedId: string) {
    super(`Já existe uma ordem ativa para este leito`);
  }
}

/**
 * Authorization errors
 */
export class UnauthorizedError extends TRPCError {
  constructor(message = 'Não autorizado') {
    super({ code: 'UNAUTHORIZED', message });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends TRPCError {
  constructor(message = 'Acesso negado') {
    super({ code: 'FORBIDDEN', message });
    this.name = 'ForbiddenError';
  }
}

export class InsufficientPermissionsError extends ForbiddenError {
  constructor(requiredRole: string) {
    super(`Esta ação requer permissão de ${requiredRole}`);
  }
}

/**
 * Database errors
 */
export class DatabaseError extends TRPCError {
  constructor(message: string, cause?: unknown) {
    super({ code: 'INTERNAL_SERVER_ERROR', message, cause });
    this.name = 'DatabaseError';
  }
}

/**
 * Helper to convert Prisma errors to friendly errors
 */
export function handlePrismaError(error: unknown): TRPCError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      const field = (error.meta?.target as string[])?.[0] || 'campo';
      return new ValidationError(`Já existe um registro com este ${field}`, field);
    }

    // Record not found
    if (error.code === 'P2025') {
      return new NotFoundError('Registro');
    }

    // Foreign key constraint violation
    if (error.code === 'P2003') {
      return new ValidationError('Referência inválida a outro registro');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Dados inválidos fornecidos');
  }

  // Default database error
  return new DatabaseError('Erro ao acessar o banco de dados', error);
}

/**
 * Usage examples:
 * 
 * @example
 * ```typescript
 * import { BedNotFoundError, handlePrismaError } from '../utils/errors';
 * 
 * // Throw specific error
 * const bed = await prisma.bed.findUnique({ where: { id } });
 * if (!bed) {
 *   throw new BedNotFoundError(id);
 * }
 * 
 * // Handle Prisma errors
 * try {
 *   await prisma.user.create({ data: { cpf: '123' } });
 * } catch (error) {
 *   throw handlePrismaError(error);
 * }
 * ```
 */
