import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, ServiceOrder, Team, ComplementItem, OSStatus, BedStatus } from './types';
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
} from './constants';

// Tipo para Database do sql.js
type Database = any;

let dbInstance: Database | null = null;

// Inicializa o banco de dados SQLite
export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  // Carregar sql.js - usar CDN diretamente via script tag se necessário
  // ou importar do pacote instalado
  let initSqlJs: any;
  
  try {
    // Tentar importar do pacote instalado primeiro
    const sqljsModule = await import('sql.js');
    initSqlJs = sqljsModule.default;
    
    // Se não tiver default, tentar outras formas
    if (!initSqlJs || typeof initSqlJs !== 'function') {
      initSqlJs = (sqljsModule as any).initSqlJs;
    }
    
    // Se ainda não funcionar, usar via script tag
    if (!initSqlJs || typeof initSqlJs !== 'function') {
      throw new Error('Tentando via script tag');
    }
  } catch (error) {
    // Fallback: carregar via script tag do CDN
    return new Promise((resolve, reject) => {
      if ((window as any).initSqlJs) {
        initSqlJs = (window as any).initSqlJs;
        loadDatabase(initSqlJs).then(resolve).catch(reject);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://sql.js.org/dist/sql-wasm.js';
      script.onload = () => {
        initSqlJs = (window as any).initSqlJs;
        loadDatabase(initSqlJs).then(resolve).catch(reject);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  return loadDatabase(initSqlJs);
}

async function loadDatabase(initSqlJs: any): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // Usar CDN para o arquivo WASM
      return `https://sql.js.org/dist/${file}`;
    }
  });

  // Tenta carregar banco existente do localStorage
  const savedDb = localStorage.getItem('higibed_sqlite_db');
  
  if (savedDb) {
    try {
      const binary = atob(savedDb);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
      }
      dbInstance = new SQL.Database(buffer);
      // Executar migração para garantir que colunas CPF existam
      migrateDatabase(dbInstance);
    } catch (error) {
      // Se houver erro ao carregar, criar novo banco
      console.warn('Erro ao carregar banco do localStorage, criando novo:', error);
      dbInstance = new SQL.Database();
      createTables(dbInstance);
      seedInitialData(dbInstance);
    }
  } else {
    dbInstance = new SQL.Database();
    createTables(dbInstance);
    seedInitialData(dbInstance);
  }

  // Executar migração para garantir que colunas CPF existam (também para banco novo)
  migrateDatabase(dbInstance);

  return dbInstance;
}

// Salva o banco no localStorage
export function saveDatabase(db: Database) {
  const data = db.export();
  // Converter Uint8Array para base64 sem usar Buffer
  const binary = String.fromCharCode(...data);
  const base64 = btoa(binary);
  localStorage.setItem('higibed_sqlite_db', base64);
}

// Migração: adiciona colunas CPF se não existirem
function migrateDatabase(db: Database): void {
  let needsMigration = false;
  
  try {
    // Tentar adicionar as colunas - SQLite não suporta IF NOT EXISTS em ALTER TABLE
    // Então vamos tentar e ignorar o erro se já existirem
    db.run('ALTER TABLE users ADD COLUMN cpf TEXT');
    needsMigration = true;
  } catch (error: any) {
    // Se der erro, provavelmente a coluna já existe
    if (error && !error.message?.includes('duplicate column')) {
      console.log('Erro ao adicionar coluna cpf:', error);
    }
  }
  
  try {
    db.run('ALTER TABLE users ADD COLUMN cpfHash TEXT');
    needsMigration = true;
  } catch (error: any) {
    // Se der erro, provavelmente a coluna já existe
    if (error && !error.message?.includes('duplicate column')) {
      console.log('Erro ao adicionar coluna cpfHash:', error);
    }
  }
  
  // Se a migração foi executada, atualizar admin e salvar
  if (needsMigration) {
    try {
      // Atualizar admin com CPF se ainda não tiver
      const adminStmt = db.prepare("SELECT * FROM users WHERE id = 'u1'");
      const adminRows: any[] = [];
      while (adminStmt.step()) {
        adminRows.push(adminStmt.getAsObject());
      }
      adminStmt.free();
      
      if (adminRows.length > 0) {
        const admin = adminRows[0];
        // Verificar se admin não tem CPF (pode ser null ou undefined)
        if (!admin.cpf || admin.cpf === null) {
          db.run(
            "UPDATE users SET cpf = ?, cpfHash = ? WHERE id = 'u1'",
            ['00000000000', '645a8aca5a5b84527c57ee2f153f1946']
          );
        }
      }
    } catch (error) {
      console.log('Erro ao atualizar admin:', error);
    }
    
    // Salvar banco após migração
    saveDatabase(db);
  }
}

// Cria todas as tabelas do banco
function createTables(db: Database): void {
  // Tabela de empresas
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT NOT NULL
    )
  `);

  // Tabela de unidades
  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de setores
  db.run(`
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitId TEXT NOT NULL,
      FOREIGN KEY (unitId) REFERENCES units(id)
    )
  `);

  // Tabela de leitos
  db.run(`
    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sectorId TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (sectorId) REFERENCES sectors(id)
    )
  `);

  // Tabela de tipos de serviço
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      config TEXT,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de ações/status
  db.run(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (serviceId) REFERENCES services(id)
    )
  `);

  // Tabela de usuários
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      userIds TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de itens complementares
  db.run(`
    CREATE TABLE IF NOT EXISTS complement_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitCost REAL NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  // Tabela de ordens de serviço
  db.run(`
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
function seedInitialData(db: Database) {
  // Inserir empresa
  db.run(
    `INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)`,
    [INITIAL_COMPANY.id, INITIAL_COMPANY.name, INITIAL_COMPANY.cnpj]
  );

  // Inserir unidades
  INITIAL_UNITS.forEach(unit => {
    db.run(
      `INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)`,
      [unit.id, unit.name, unit.companyId]
    );
  });

  // Inserir setores
  INITIAL_SECTORS.forEach(sector => {
    db.run(
      `INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)`,
      [sector.id, sector.name, sector.unitId]
    );
  });

  // Inserir leitos
  INITIAL_BEDS.forEach(bed => {
    db.run(
      `INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)`,
      [bed.id, bed.name, bed.sectorId, bed.status]
    );
  });

  // Inserir serviços
  INITIAL_SERVICES.forEach(service => {
    const config = service.config ? JSON.stringify(service.config) : null;
    db.run(
      `INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)`,
      [service.id, service.name, service.companyId, config]
    );
  });

  // Inserir ações
  INITIAL_ACTIONS.forEach(action => {
    db.run(
      `INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)`,
      [action.id, action.serviceId, action.name, action.order]
    );
  });

  // Inserir usuários
  MOCK_USERS.forEach(user => {
    const permissions = JSON.stringify(user.permissions);
    db.run(
      `INSERT INTO users (id, name, email, login, password, cpf, cpfHash, companyId, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, 
        user.name, 
        user.email, 
        user.login || null, 
        user.password || null, 
        user.cpf || null,
        user.cpfHash || null,
        user.companyId, 
        permissions
      ]
    );
  });

  // Inserir equipes
  INITIAL_TEAMS.forEach(team => {
    const userIds = JSON.stringify(team.userIds);
    db.run(
      `INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)`,
      [team.id, team.name, team.companyId, userIds]
    );
  });

  // Inserir itens complementares
  INITIAL_COMPLEMENT_ITEMS.forEach(item => {
    db.run(
      `INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)`,
      [item.id, item.name, item.unitCost, item.companyId]
    );
  });

  saveDatabase(db);
}

// Funções auxiliares para conversão de dados

export function rowToCompany(row: any[]): Company {
  return {
    id: row[0] as string,
    name: row[1] as string,
    cnpj: row[2] as string
  };
}

export function rowToUnit(row: any[]): Unit {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string
  };
}

export function rowToSector(row: any[]): Sector {
  return {
    id: row[0] as string,
    name: row[1] as string,
    unitId: row[2] as string
  };
}

export function rowToBed(row: any[]): Bed {
  return {
    id: row[0] as string,
    name: row[1] as string,
    sectorId: row[2] as string,
    status: row[3] as BedStatus
  };
}

export function rowToService(row: any[]): ServiceType {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string,
    config: row[3] ? JSON.parse(row[3] as string) : undefined
  };
}

export function rowToAction(row: any[]): ActionStatus {
  return {
    id: row[0] as string,
    serviceId: row[1] as string,
    name: row[2] as string,
    order: row[3] as number
  };
}

export function rowToUser(row: any[]): User {
  return {
    id: row[0] as string,
    name: row[1] as string,
    email: row[2] as string,
    login: row[3] as string || undefined,
    password: row[4] as string || undefined,
    cpf: row[5] as string || undefined,
    cpfHash: row[6] as string || undefined,
    companyId: row[7] as string,
    permissions: JSON.parse(row[8] as string)
  };
}

export function rowToTeam(row: any[]): Team {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string,
    userIds: JSON.parse(row[3] as string)
  };
}

export function rowToComplementItem(row: any[]): ComplementItem {
  return {
    id: row[0] as string,
    name: row[1] as string,
    unitCost: row[2] as number,
    companyId: row[3] as string
  };
}

export function rowToServiceOrder(row: any[]): ServiceOrder {
  return {
    id: row[0] as string,
    groupId: row[1] as string,
    bedId: row[2] as string,
    serviceId: row[3] as string,
    requesterUserId: row[4] as string,
    subServiceName: row[5] as string || undefined,
    step: row[6] as number,
    currentActionId: row[7] as string,
    responsibleUserId: row[8] as string || null,
    assignedTeamId: row[9] as string || undefined,
    companyId: row[10] as string,
    requestedAt: row[11] as string,
    startedAt: row[12] as string || undefined,
    finishedAt: row[13] as string || undefined,
    status: row[14] as OSStatus,
    items: JSON.parse(row[15] as string),
    history: JSON.parse(row[16] as string)
  };
}

export function getDatabase(): Database | null {
  return dbInstance;
}
