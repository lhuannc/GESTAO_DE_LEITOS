

// BedStatus is now dynamic, defined at the end of file


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

export interface Section {
  id: string;
  name: string;
  sectorId: string;
  sector?: Sector;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bed {
  id: string;
  name: string;
  sectorId: string;
  sector?: Sector;
  sectionId?: string;
  section?: Section;
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
  bedStatusConfig?: {
    onStart?: BedStatus;
    onFinish?: BedStatus;
  };
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
  serviceTypeId: string;
  serviceId?: string; // Legacy
  requestedById: string;
  requesterUserId?: string; // Legacy
  subServiceName?: string;
  step: number;
  status: OSStatus;
  priority: number;
  notes?: string;
  assignedToTeamId?: string | null;
  assignedToUserId?: string | null;
  responsibleUserId?: string | null; // Legacy
  items: SelectedItem[];
  history: {
    status: OSStatus;
    userId: string;
    timestamp: string;
    note?: string;
  }[];
  dependsOnOrderIds?: string[];
  createdAt: string;
  requestedAt?: string; // Legacy
  updatedAt: string;
  completedAt?: string | null;
  finishedAt?: string; // Legacy
}

export type ViewType = 'DASHBOARD' | 'DASHBOARD_OPERACIONAL' | 'SOLICITAR' | 'ORDENS' | 'CADASTROS' | 'PESQUISA_ACOES';

export interface BedStatusConfig {
  id: string;
  name: string;
  color: string; // Classe Tailwind ou Hex
  companyId: string;
  isDefault?: boolean;
}

// Redefine BedStatus to be dynamic (string) but compatible with keys
export type BedStatus = string;
