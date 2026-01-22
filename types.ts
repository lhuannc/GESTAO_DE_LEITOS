
export type BedStatus = 'DISPONIVEL' | 'OCUPADO' | 'HIGIENIZACAO' | 'MANUTENCAO' | 'AGUARDANDO_ALTA';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
}

export interface Unit {
  id: string;
  name: string;
  companyId: string;
}

export interface Sector {
  id: string;
  name: string;
  unitId: string;
}

export interface Bed {
  id: string;
  name: string;
  sectorId: string;
  status: BedStatus;
}

export type OSStatus = 'BLOQUEADO' | 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO';

export interface Team {
  id: string;
  name: string;
  companyId: string;
  userIds: string[];
}

export interface ComplementItem {
  id: string;
  name: string;
  unitCost: number;
  companyId: string;
}

// Etapa independente (cadastrada separadamente)
export interface Step {
  id: string;
  name: string;
  companyId: string;
  targetTeamId: string; // Equipe responsável pela etapa
  allowedItemIds: string[]; // IDs dos insumos permitidos nesta etapa
  slaMinutes?: number; // SLA em minutos (tempo máximo esperado)
}

export interface SubOrderConfig {
  stepId: string; // ID da etapa cadastrada (referência)
  // Mantido para compatibilidade com dados antigos
  name?: string;
  initialStatus?: OSStatus;
  targetTeamId?: string;
  allowedItemIds?: string[];
}

export interface ServiceType {
  id: string;
  name: string;
  companyId: string;
  config?: {
    generateMultipleOS?: boolean;
    subOrders?: SubOrderConfig[];
  };
}

export interface ActionStatus {
  id: string;
  serviceId: string;
  name: string;
  order: number;
}

export interface UserPermissions {
  pages: string[];
  modules: string[];
  isAdmin: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  login?: string; // Novo: login do usuário
  password?: string; // Novo: senha do usuário
  cpf?: string; // CPF do usuário
  cpfHash?: string; // Hash MD5 do CPF
  companyId: string;
  permissions: UserPermissions;
}

export interface SelectedItem {
  itemId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface ServiceOrder {
  id: string;
  groupId: string;
  bedId: string;
  serviceId: string;
  requesterUserId: string; // Adicionado para rastrear o solicitante
  subServiceName?: string;
  step: number;
  currentActionId: string;
  responsibleUserId: string | null;
  assignedTeamId?: string;
  companyId: string;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: OSStatus;
  items: SelectedItem[]; // Itens e serviços extras selecionados para esta OS
  history: {
    status: OSStatus;
    userId: string;
    timestamp: string;
    note?: string;
  }[];
}

export type ViewType = 'DASHBOARD' | 'DASHBOARD_OPERACIONAL' | 'SOLICITAR' | 'ORDENS' | 'CADASTROS';
