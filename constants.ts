
import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, BedStatus, Team, ComplementItem, Step } from './types';

export const INITIAL_COMPANY: Company = {
  id: 'c1',
  name: 'Hospital Central de Diagnóstico',
  cnpj: '12.345.678/0001-99'
};

export const INITIAL_USER: User = {
  id: 'u1',
  name: 'Administrador do Sistema',
  email: 'admin@higi-bed.com.br',
  login: 'ADMIN',
  password: 'ADMIN',
  cpf: '00000000000',
  cpfHash: '645a8aca5a5b84527c57ee2f153f1946', // MD5 de '00000000000'
  companyId: 'c1',
  permissions: {
    pages: ['dashboard', 'solicitar', 'ordens', 'cadastros'],
    modules: ['all'],
    isAdmin: true
  }
};

export const MOCK_USERS: User[] = [
  INITIAL_USER,
  {
    id: 'u2',
    name: 'João da Silva (Higiene)',
    email: 'joao@higi-bed.com.br',
    login: 'joao.higiene',
    password: '123',
    companyId: 'c1',
    permissions: {
      pages: ['dashboard', 'ordens'],
      modules: ['bed', 'service'],
      isAdmin: false
    }
  },
  {
    id: 'u3',
    name: 'Maria Lima (Rouparia)',
    email: 'maria@higi-bed.com.br',
    login: 'maria.roupas',
    password: '123',
    companyId: 'c1',
    permissions: {
      pages: ['dashboard', 'ordens'],
      modules: ['bed', 'service'],
      isAdmin: false
    }
  }
];

export const INITIAL_COMPLEMENT_ITEMS: ComplementItem[] = [
  { id: 'it-1', name: 'Kit Higiene Padrão', unitCost: 15.50, companyId: 'c1' },
  { id: 'it-2', name: 'Kit Higiene Premium (Desinfecção)', unitCost: 45.00, companyId: 'c1' },
  { id: 'it-3', name: 'Kit Enxoval Solteiro', unitCost: 22.00, companyId: 'c1' },
  { id: 'it-4', name: 'Kit Enxoval Casal/Especial', unitCost: 35.00, companyId: 'c1' },
  { id: 'it-5', name: 'Reparo de Ar Condicionado (Hora)', unitCost: 120.00, companyId: 'c1' }
];

export const INITIAL_TEAMS: Team[] = [
  { id: 'tm-1', name: 'Equipe de Higiene Terminal', companyId: 'c1', userIds: ['u2'] },
  { id: 'tm-2', name: 'Equipe de Rouparia/Enxoval', companyId: 'c1', userIds: ['u3'] }
];

export const INITIAL_UNITS: Unit[] = [
  { id: 'un-1', name: 'Unidade de Internação', companyId: 'c1' },
  { id: 'un-2', name: 'Pronto Atendimento', companyId: 'c1' }
];

export const INITIAL_SECTORS: Sector[] = [
  { id: 'st-1', name: 'UTI Adulto', unitId: 'un-1' },
  { id: 'st-2', name: 'Enfermaria A', unitId: 'un-1' }
];

export const INITIAL_BEDS: Bed[] = [
  { id: 'bd-1', name: 'Leito 101', sectorId: 'st-1', status: 'OCUPADO' },
  { id: 'bd-2', name: 'Leito 102', sectorId: 'st-1', status: 'AGUARDANDO_ALTA' },
  { id: 'bd-3', name: 'Leito 201', sectorId: 'st-2', status: 'DISPONIVEL' }
];

export const INITIAL_SERVICES: ServiceType[] = [
  { 
    id: 'sv-1', 
    name: 'Higienização Terminal Completa', 
    companyId: 'c1',
    config: {
      generateMultipleOS: true,
      subOrders: [
        { name: 'Limpeza Técnica', initialStatus: 'PENDENTE', targetTeamId: 'tm-1', allowedItemIds: ['it-1', 'it-2'] },
        { name: 'Troca de Enxoval', initialStatus: 'BLOQUEADO', targetTeamId: 'tm-2', allowedItemIds: ['it-3', 'it-4'] }
      ]
    }
  }
];

export const INITIAL_ACTIONS: ActionStatus[] = [];

export const INITIAL_STEPS: Step[] = [
  {
    id: 'stp-1',
    name: 'Limpeza Técnica',
    companyId: 'c1',
    targetTeamId: 'tm-1', // Equipe de Higiene Terminal
    allowedItemIds: ['it-1', 'it-2'] // Kit Higiene Padrão e Premium
  },
  {
    id: 'stp-2',
    name: 'Troca de Enxoval',
    companyId: 'c1',
    targetTeamId: 'tm-2', // Equipe de Rouparia/Enxoval
    allowedItemIds: ['it-3', 'it-4'] // Kit Enxoval Solteiro e Casal/Especial
  }
];

export const BED_STATUS_COLORS: Record<BedStatus, string> = {
  DISPONIVEL: 'bg-emerald-500',
  OCUPADO: 'bg-rose-500',
  HIGIENIZACAO: 'bg-amber-500',
  MANUTENCAO: 'bg-slate-500',
  AGUARDANDO_ALTA: 'bg-sky-500'
};
