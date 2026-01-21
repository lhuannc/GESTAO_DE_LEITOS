import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do banco de dados SQLite
const dbPath = path.join(__dirname, 'data', 'gestao_leitos.db');
const dataDir = path.dirname(dbPath);

// Garantir que o diretório existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar banco de dados
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Criar tabelas (mesmo código do server.js)
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitId TEXT NOT NULL,
      FOREIGN KEY (unitId) REFERENCES units(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sectorId TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (sectorId) REFERENCES sectors(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      config TEXT,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (serviceId) REFERENCES services(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      login TEXT,
      password TEXT,
      cpf TEXT,
      cpfHash TEXT,
      faceDescriptor TEXT,
      companyId TEXT NOT NULL,
      permissions TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyId TEXT NOT NULL,
      userIds TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS complement_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitCost REAL NOT NULL,
      companyId TEXT NOT NULL,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    )
  `);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS service_order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT NOT NULL,
      status TEXT NOT NULL,
      userId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      note TEXT,
      actionId TEXT,
      FOREIGN KEY (orderId) REFERENCES service_orders(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_history_orderId ON service_order_history(orderId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_groupId ON service_orders(groupId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_bedId ON service_orders(bedId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
  `);
}

// Função para carregar dados do localStorage (simulando navegador)
async function loadFromLocalStorage() {
  // Esta função será executada no navegador para exportar os dados
  // Por enquanto, vamos criar um script separado que o usuário pode rodar no navegador
  console.log(`
    ⚠️  MIGRAÇÃO DE DADOS DO LOCALSTORAGE
    
    Para migrar os dados existentes do localStorage:
    
    1. Abra o console do navegador (F12)
    2. Cole e execute o seguinte código:
    
    // Exportar dados
    const db = localStorage.getItem('gestao_leitos_sqlite_db');
    if (db) {
      // Carregar sql.js
      const script = document.createElement('script');
      script.src = 'https://sql.js.org/dist/sql-wasm.js';
      script.onload = async () => {
        const SQL = await initSqlJs({
          locateFile: file => \`https://sql.js.org/dist/\${file}\`
        });
        const binary = atob(db);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          buffer[i] = binary.charCodeAt(i);
        }
        const sqliteDb = new SQL.Database(buffer);
        
        // Exportar todos os dados
        const exportData = {};
        
        ['companies', 'units', 'sectors', 'beds', 'services', 'actions', 'users', 'teams', 'complement_items', 'service_orders'].forEach(table => {
          const result = sqliteDb.exec(\`SELECT * FROM \${table}\`);
          if (result.length > 0) {
            exportData[table] = result[0].values.map(row => {
              const cols = sqliteDb.exec(\`PRAGMA table_info(\${table})\`)[0].values;
              const obj = {};
              cols.forEach((col, idx) => {
                obj[col[1]] = row[idx];
              });
              return obj;
            });
          }
        });
        
        console.log(JSON.stringify(exportData, null, 2));
        
        // Copiar o JSON e salvar em data-export.json
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data-export.json';
        a.click();
      };
      document.head.appendChild(script);
    } else {
      console.log('Nenhum dado encontrado no localStorage');
    }
  `);
}

// Função para importar dados do JSON
function importFromJSON(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    console.log(`❌ Arquivo não encontrado: ${jsonPath}`);
    console.log('Execute primeiro a exportação do localStorage no navegador.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log('📦 Importando dados...');

  // Limpar tabelas existentes (cuidado!)
  db.exec('DELETE FROM service_order_history');
  db.exec('DELETE FROM service_orders');
  db.exec('DELETE FROM complement_items');
  db.exec('DELETE FROM teams');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM actions');
  db.exec('DELETE FROM services');
  db.exec('DELETE FROM beds');
  db.exec('DELETE FROM sectors');
  db.exec('DELETE FROM units');
  db.exec('DELETE FROM companies');

  // Inserir companies
  if (data.companies) {
    const stmt = db.prepare('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)');
    data.companies.forEach(row => {
      stmt.run(row.id, row.name, row.cnpj);
    });
    console.log(`✓ Importadas ${data.companies.length} empresas`);
  }

  // Inserir units
  if (data.units) {
    const stmt = db.prepare('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)');
    data.units.forEach(row => {
      stmt.run(row.id, row.name, row.companyId);
    });
    console.log(`✓ Importadas ${data.units.length} unidades`);
  }

  // Inserir sectors
  if (data.sectors) {
    const stmt = db.prepare('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)');
    data.sectors.forEach(row => {
      stmt.run(row.id, row.name, row.unitId);
    });
    console.log(`✓ Importados ${data.sectors.length} setores`);
  }

  // Inserir beds
  if (data.beds) {
    const stmt = db.prepare('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)');
    data.beds.forEach(row => {
      stmt.run(row.id, row.name, row.sectorId, row.status);
    });
    console.log(`✓ Importados ${data.beds.length} leitos`);
  }

  // Inserir services
  if (data.services) {
    const stmt = db.prepare('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)');
    data.services.forEach(row => {
      stmt.run(row.id, row.name, row.companyId, row.config || null);
    });
    console.log(`✓ Importados ${data.services.length} serviços`);
  }

  // Inserir actions
  if (data.actions) {
    const stmt = db.prepare('INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)');
    data.actions.forEach(row => {
      stmt.run(row.id, row.serviceId, row.name, row.order);
    });
    console.log(`✓ Importadas ${data.actions.length} ações`);
  }

  // Inserir users
  if (data.users) {
    const stmt = db.prepare(`
      INSERT INTO users 
      (id, name, email, login, password, cpf, cpfHash, faceDescriptor, companyId, permissions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    data.users.forEach(row => {
      const faceDescriptor = row.faceDescriptor ? (typeof row.faceDescriptor === 'string' ? row.faceDescriptor : JSON.stringify(row.faceDescriptor)) : null;
      stmt.run(
        row.id, row.name, row.email, row.login || null, row.password || null,
        row.cpf || null, row.cpfHash || null, faceDescriptor,
        row.companyId, row.permissions
      );
    });
    console.log(`✓ Importados ${data.users.length} usuários`);
  }

  // Inserir teams
  if (data.teams) {
    const stmt = db.prepare('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)');
    data.teams.forEach(row => {
      const userIds = typeof row.userIds === 'string' ? row.userIds : JSON.stringify(row.userIds);
      stmt.run(row.id, row.name, row.companyId, userIds);
    });
    console.log(`✓ Importadas ${data.teams.length} equipes`);
  }

  // Inserir complement_items
  if (data.complement_items) {
    const stmt = db.prepare('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)');
    data.complement_items.forEach(row => {
      stmt.run(row.id, row.name, row.unitCost, row.companyId);
    });
    console.log(`✓ Importados ${data.complement_items.length} itens complementares`);
  }

  // Inserir service_orders
  if (data.service_orders) {
    const stmt = db.prepare(`
      INSERT INTO service_orders 
      (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
       responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    data.service_orders.forEach(row => {
      const items = typeof row.items === 'string' ? row.items : JSON.stringify(row.items);
      const history = typeof row.history === 'string' ? row.history : JSON.stringify(row.history);
      
      stmt.run(
        row.id, row.groupId, row.bedId, row.serviceId, row.requesterUserId,
        row.subServiceName || null, row.step, row.currentActionId || '',
        row.responsibleUserId || null, row.assignedTeamId || null, row.companyId,
        row.requestedAt, row.startedAt || null, row.finishedAt || null,
        row.status, items, history
      );

      // Inserir histórico
      const historyArray = typeof row.history === 'string' ? JSON.parse(row.history) : row.history;
      if (Array.isArray(historyArray)) {
        const historyStmt = db.prepare(`
          INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
          VALUES (?, ?, ?, ?, ?)
        `);
        historyArray.forEach(entry => {
          historyStmt.run(row.id, entry.status, entry.userId, entry.timestamp, entry.note || null);
        });
      }
    });
    console.log(`✓ Importadas ${data.service_orders.length} ordens de serviço`);
  }

  console.log('\n✅ Migração concluída com sucesso!');
  console.log(`📁 Banco de dados: ${dbPath}`);
}

// Executar migração
createTables();

const jsonPath = path.join(__dirname, 'data-export.json');
if (fs.existsSync(jsonPath)) {
  importFromJSON(jsonPath);
} else {
  loadFromLocalStorage();
  console.log(`\n💡 Dica: Exporte os dados do localStorage e salve como 'data-export.json' na raiz do projeto.`);
  console.log(`   Depois execute novamente: npm run migrate`);
}

db.close();
