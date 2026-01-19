import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  INITIAL_COMPANY,
  MOCK_USERS,
  INITIAL_UNITS,
  INITIAL_SECTORS,
  INITIAL_BEDS,
  INITIAL_SERVICES,
  INITIAL_ACTIONS,
  INITIAL_TEAMS,
  INITIAL_COMPLEMENT_ITEMS
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do banco de dados SQLite
const DB_PATH = path.join(__dirname, '..', 'data', 'gestao_leitos.db');

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    // Criar diretório data se não existir
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL'); // Melhor performance
    dbInstance.pragma('foreign_keys = ON'); // Habilitar foreign keys
    
    // Criar tabelas se não existirem
    createTables(dbInstance);
    
    // Verificar se há dados, se não houver, popular com dados iniciais
    const companies = dbInstance.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
    if (companies.count === 0) {
      seedInitialData(dbInstance);
    }
    
    // Executar migrações
    migrateDatabase(dbInstance);
  }
  
  return dbInstance;
}

// Cria todas as tabelas do banco
function createTables(db: Database.Database): void {
  // Tabela de empresas
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT NOT NULL
    )
  `);

  // Tabela de unidades
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de setores
  db.exec(`
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitId TEXT NOT NULL,
      FOREIGN KEY (unitId) REFERENCES units(id)
    )
  `);

  // Tabela de leitos
  db.exec(`
    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sectorId TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (sectorId) REFERENCES sectors(id)
    )
  `);

  // Tabela de tipos de serviço
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      config TEXT,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de ações/status
  db.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (serviceId) REFERENCES services(id)
    )
  `);

  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      login TEXT,
      password TEXT,
      cpf TEXT,
      cpfHash TEXT,
      companyId TEXT NOT NULL,
      permissions TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de equipes
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      userIds TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de itens complementares
  db.exec(`
    CREATE TABLE IF NOT EXISTS complement_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitCost REAL NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de ordens de serviço
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      bedId TEXT NOT NULL,
      serviceId TEXT NOT NULL,
      requesterUserId TEXT NOT NULL,
      subServiceName TEXT,
      step INTEGER NOT NULL,
      currentActionId TEXT,
      responsibleUserId TEXT,
      assignedTeamId TEXT,
      companyId TEXT NOT NULL,
      requestedAt TEXT NOT NULL,
      startedAt TEXT,
      finishedAt TEXT,
      status TEXT NOT NULL,
      items TEXT NOT NULL,
      history TEXT NOT NULL,
      FOREIGN KEY (bedId) REFERENCES beds(id),
      FOREIGN KEY (serviceId) REFERENCES services(id),
      FOREIGN KEY (requesterUserId) REFERENCES users(id),
      FOREIGN KEY (responsibleUserId) REFERENCES users(id),
      FOREIGN KEY (assignedTeamId) REFERENCES teams(id),
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);
}

// Popula o banco com dados iniciais
function seedInitialData(db: Database.Database): void {
  const insertCompany = db.prepare('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)');
  insertCompany.run(INITIAL_COMPANY.id, INITIAL_COMPANY.name, INITIAL_COMPANY.cnpj);

  const insertUnit = db.prepare('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)');
  INITIAL_UNITS.forEach(unit => {
    insertUnit.run(unit.id, unit.name, unit.companyId);
  });

  const insertSector = db.prepare('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)');
  INITIAL_SECTORS.forEach(sector => {
    insertSector.run(sector.id, sector.name, sector.unitId);
  });

  const insertBed = db.prepare('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)');
  INITIAL_BEDS.forEach(bed => {
    insertBed.run(bed.id, bed.name, bed.sectorId, bed.status);
  });

  const insertService = db.prepare('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)');
  INITIAL_SERVICES.forEach(service => {
    const config = service.config ? JSON.stringify(service.config) : null;
    insertService.run(service.id, service.name, service.companyId, config);
  });

  const insertAction = db.prepare('INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)');
  INITIAL_ACTIONS.forEach(action => {
    insertAction.run(action.id, action.serviceId, action.name, action.order);
  });

  const insertUser = db.prepare('INSERT INTO users (id, name, email, login, password, cpf, cpfHash, companyId, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  MOCK_USERS.forEach(user => {
    const permissions = JSON.stringify(user.permissions);
    insertUser.run(
      user.id,
      user.name,
      user.email,
      user.login || null,
      user.password || null,
      user.cpf || null,
      user.cpfHash || null,
      user.companyId,
      permissions
    );
  });

  const insertTeam = db.prepare('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)');
  INITIAL_TEAMS.forEach(team => {
    const userIds = JSON.stringify(team.userIds);
    insertTeam.run(team.id, team.name, team.companyId, userIds);
  });

  const insertComplementItem = db.prepare('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)');
  INITIAL_COMPLEMENT_ITEMS.forEach(item => {
    insertComplementItem.run(item.id, item.name, item.unitCost, item.companyId);
  });
}

// Migração: adiciona colunas CPF se não existirem
function migrateDatabase(db: Database.Database): void {
  try {
    // Verificar se a coluna cpf existe
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasCpf = tableInfo.some(col => col.name === 'cpf');
    
    if (!hasCpf) {
      db.exec('ALTER TABLE users ADD COLUMN cpf TEXT');
      db.exec('ALTER TABLE users ADD COLUMN cpfHash TEXT');
    }
  } catch (error) {
    // Ignorar erro se colunas já existirem
    console.warn('Erro na migração (provavelmente colunas já existem):', error);
  }
}

// Converter rows do banco para objetos TypeScript
export function rowToCompany(row: any) {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj
  };
}

export function rowToUnit(row: any) {
  return {
    id: row.id,
    name: row.name,
    companyId: row.companyId
  };
}

export function rowToSector(row: any) {
  return {
    id: row.id,
    name: row.name,
    unitId: row.unitId
  };
}

export function rowToBed(row: any) {
  return {
    id: row.id,
    name: row.name,
    sectorId: row.sectorId,
    status: row.status
  };
}

export function rowToService(row: any) {
  return {
    id: row.id,
    name: row.name,
    companyId: row.companyId,
    config: row.config ? JSON.parse(row.config) : undefined
  };
}

export function rowToAction(row: any) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    name: row.name,
    order: row.order
  };
}

export function rowToUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    login: row.login || undefined,
    password: row.password || undefined,
    cpf: row.cpf || undefined,
    cpfHash: row.cpfHash || undefined,
    companyId: row.companyId,
    permissions: JSON.parse(row.permissions)
  };
}

export function rowToTeam(row: any) {
  return {
    id: row.id,
    name: row.name,
    companyId: row.companyId,
    userIds: JSON.parse(row.userIds)
  };
}

export function rowToComplementItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    unitCost: row.unitCost,
    companyId: row.companyId
  };
}

export function rowToServiceOrder(row: any) {
  return {
    id: row.id,
    groupId: row.groupId,
    bedId: row.bedId,
    serviceId: row.serviceId,
    requesterUserId: row.requesterUserId,
    subServiceName: row.subServiceName || undefined,
    step: row.step,
    currentActionId: row.currentActionId || undefined,
    responsibleUserId: row.responsibleUserId || undefined,
    assignedTeamId: row.assignedTeamId || undefined,
    companyId: row.companyId,
    requestedAt: row.requestedAt,
    startedAt: row.startedAt || undefined,
    finishedAt: row.finishedAt || undefined,
    status: row.status,
    items: JSON.parse(row.items),
    history: JSON.parse(row.history)
  };
}
