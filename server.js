import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentar limite para faceDescriptor

// Caminho do banco de dados SQLite
const dbPath = path.join(__dirname, 'data', 'gestao_leitos.db');
const dataDir = path.dirname(dbPath);

// Garantir que o diretório existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar banco de dados
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Criar tabelas
function createTables() {
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

  // Tabela de usuários (com faceDescriptor)
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

  // Tabela de histórico de etapas das OS (para rastreamento completo)
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

  // Índices para melhor performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_history_orderId ON service_order_history(orderId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_groupId ON service_orders(groupId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_bedId ON service_orders(bedId);
    CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
  `);
}

// Funções auxiliares
function parseUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    login: row.login || undefined,
    password: row.password || undefined,
    cpf: row.cpf || undefined,
    cpfHash: row.cpfHash || undefined,
    faceDescriptor: row.faceDescriptor ? JSON.parse(row.faceDescriptor) : undefined,
    companyId: row.companyId,
    permissions: JSON.parse(row.permissions)
  };
}

function parseServiceOrder(row) {
  return {
    id: row.id,
    groupId: row.groupId,
    bedId: row.bedId,
    serviceId: row.serviceId,
    requesterUserId: row.requesterUserId,
    subServiceName: row.subServiceName || undefined,
    step: row.step,
    currentActionId: row.currentActionId,
    responsibleUserId: row.responsibleUserId || null,
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

// Rotas

// GET /api/data - Obter todos os dados
app.get('/api/data', (req, res) => {
  try {
    const companies = db.prepare('SELECT * FROM companies').all();
    const units = db.prepare('SELECT * FROM units').all();
    const sectors = db.prepare('SELECT * FROM sectors').all();
    const beds = db.prepare('SELECT * FROM beds').all();
    const services = db.prepare('SELECT * FROM services').all().map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : undefined
    }));
    const actions = db.prepare('SELECT * FROM actions').all();
    const users = db.prepare('SELECT * FROM users').all().map(parseUser);
    const teams = db.prepare('SELECT * FROM teams').all().map(row => ({
      ...row,
      userIds: JSON.parse(row.userIds)
    }));
    const complementItems = db.prepare('SELECT * FROM complement_items').all();
    const orders = db.prepare('SELECT * FROM service_orders').all().map(parseServiceOrder);

    res.json({
      companies,
      units,
      sectors,
      beds,
      services,
      actions,
      users,
      teams,
      complementItems,
      orders
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth - Autenticação
app.post('/api/auth', (req, res) => {
  try {
    const { login, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE login = ? AND password = ?').get(login, password);
    
    if (user) {
      res.json(parseUser(user));
    } else {
      res.status(401).json({ error: 'Credenciais inválidas' });
    }
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/create - Criar ordens de serviço
app.post('/api/orders/create', (req, res) => {
  try {
    const { bedId, serviceId, userId, companyId, stepsItems } = req.body;
    
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const config = service.config ? JSON.parse(service.config) : undefined;
    const groupId = `group-${Date.now()}`;
    const ordersToCreate = [];

    const processItems = (step) => {
      const selections = stepsItems?.[step] || [];
      const items = db.prepare('SELECT * FROM complement_items').all();
      
      return selections.map(sel => {
        const item = items.find(i => i.id === sel.itemId);
        return {
          itemId: sel.itemId,
          name: item?.name || 'Item desconhecido',
          quantity: sel.quantity,
          unitCost: item?.unitCost || 0
        };
      });
    };

    const insertHistory = (orderId, historyEntry) => {
      db.prepare(`
        INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        orderId,
        historyEntry.status,
        historyEntry.userId,
        historyEntry.timestamp,
        historyEntry.note || null
      );
    };

    if (config?.generateMultipleOS && config.subOrders?.length) {
      config.subOrders.forEach((sub, index) => {
        const initialStatus = index === 0 ? 'PENDENTE' : 'BLOQUEADO';
        const orderId = `so-${Date.now()}-${index}`;
        
        const order = {
          id: orderId,
          groupId,
          bedId,
          serviceId,
          requesterUserId: userId,
          subServiceName: sub.name,
          step: index,
          currentActionId: '',
          responsibleUserId: null,
          assignedTeamId: sub.targetTeamId,
          companyId,
          requestedAt: new Date().toISOString(),
          status: initialStatus,
          items: processItems(index),
          history: [{
            status: initialStatus,
            userId,
            timestamp: new Date().toISOString(),
            note: index === 0 ? 'Fluxo iniciado.' : 'Aguardando dependência.'
          }]
        };

        db.prepare(`
          INSERT INTO service_orders 
          (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
           responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          order.id, order.groupId, order.bedId, order.serviceId, order.requesterUserId,
          order.subServiceName || null, order.step, order.currentActionId,
          order.responsibleUserId, order.assignedTeamId || null, order.companyId,
          order.requestedAt, order.startedAt || null, order.finishedAt || null,
          order.status, JSON.stringify(order.items), JSON.stringify(order.history)
        );

        // Inserir histórico
        order.history.forEach(entry => insertHistory(orderId, entry));

        ordersToCreate.push(order);
      });
    } else {
      const orderId = `so-${Date.now()}`;
      const order = {
        id: orderId,
        groupId,
        bedId,
        serviceId,
        requesterUserId: userId,
        step: 0,
        currentActionId: '',
        responsibleUserId: null,
        companyId,
        requestedAt: new Date().toISOString(),
        status: 'PENDENTE',
        items: processItems(0),
        history: [{
          status: 'PENDENTE',
          userId,
          timestamp: new Date().toISOString()
        }]
      };

      db.prepare(`
        INSERT INTO service_orders 
        (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
         responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, order.groupId, order.bedId, order.serviceId, order.requesterUserId,
        order.subServiceName || null, order.step, order.currentActionId,
        order.responsibleUserId, order.assignedTeamId || null, order.companyId,
        order.requestedAt, order.startedAt || null, order.finishedAt || null,
        order.status, JSON.stringify(order.items), JSON.stringify(order.history)
      );

      // Inserir histórico
      order.history.forEach(entry => insertHistory(orderId, entry));

      ordersToCreate.push(order);
    }

    // Atualizar status do leito
    db.prepare('UPDATE beds SET status = ? WHERE id = ?').run('HIGIENIZACAO', bedId);

    res.json(ordersToCreate);
  } catch (error) {
    console.error('Error creating orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/assign - Atribuir ordem
app.post('/api/orders/:id/assign', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }

    const order = parseServiceOrder(row);
    order.responsibleUserId = userId;
    order.history.push({
      status: order.status,
      userId,
      timestamp: new Date().toISOString(),
      note: 'OS assumida pelo usuário.'
    });

    db.prepare(`
      UPDATE service_orders 
      SET responsibleUserId = ?, history = ? 
      WHERE id = ?
    `).run(userId, JSON.stringify(order.history), id);

    // Inserir histórico
    const lastEntry = order.history[order.history.length - 1];
    db.prepare(`
      INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, lastEntry.status, lastEntry.userId, lastEntry.timestamp, lastEntry.note || null);

    res.json(order);
  } catch (error) {
    console.error('Error assigning order:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/unassign - Remover atribuição
app.post('/api/orders/:id/unassign', (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;

    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }

    const order = parseServiceOrder(row);
    order.responsibleUserId = null;
    order.history.push({
      status: order.status,
      userId: adminUserId,
      timestamp: new Date().toISOString(),
      note: 'Responsável removido por Administrador.'
    });

    db.prepare(`
      UPDATE service_orders 
      SET responsibleUserId = ?, history = ? 
      WHERE id = ?
    `).run(null, JSON.stringify(order.history), id);

    // Inserir histórico
    const lastEntry = order.history[order.history.length - 1];
    db.prepare(`
      INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, lastEntry.status, lastEntry.userId, lastEntry.timestamp, lastEntry.note || null);

    res.json(order);
  } catch (error) {
    console.error('Error unassigning order:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/status - Atualizar status
app.post('/api/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, userId, note } = req.body;

    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }

    const order = parseServiceOrder(row);
    
    if (status === 'BLOQUEADO' && order.status !== 'BLOQUEADO') {
      return res.json(order);
    }

    if (status === 'EM_ANDAMENTO' && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    }

    if (status === 'CONCLUIDO') {
      order.finishedAt = new Date().toISOString();
      
      // Buscar próxima ordem bloqueada do mesmo grupo
      const nextOrder = db.prepare(`
        SELECT * FROM service_orders 
        WHERE groupId = ? AND step = ? AND status = ?
      `).get(order.groupId, order.step + 1, 'BLOQUEADO');
      
      if (nextOrder) {
        const next = parseServiceOrder(nextOrder);
        next.status = 'PENDENTE';
        next.history.push({
          status: 'PENDENTE',
          userId: 'system',
          timestamp: new Date().toISOString(),
          note: 'Liberado automaticamente.'
        });

        db.prepare(`
          UPDATE service_orders 
          SET status = ?, history = ? 
          WHERE id = ?
        `).run('PENDENTE', JSON.stringify(next.history), next.id);

        // Inserir histórico
        const lastEntry = next.history[next.history.length - 1];
        db.prepare(`
          INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
          VALUES (?, ?, ?, ?, ?)
        `).run(next.id, lastEntry.status, lastEntry.userId, lastEntry.timestamp, lastEntry.note || null);
      }
    }

    order.status = status;
    order.history.push({
      status,
      userId,
      timestamp: new Date().toISOString(),
      note
    });

    if (status === 'CONCLUIDO') {
      // Verificar se há outras ordens ativas para o mesmo leito
      const otherOrders = db.prepare(`
        SELECT * FROM service_orders 
        WHERE bedId = ? AND id != ? AND status != ?
      `).all(order.bedId, id, 'CONCLUIDO');
      
      if (otherOrders.length === 0) {
        db.prepare('UPDATE beds SET status = ? WHERE id = ?').run('DISPONIVEL', order.bedId);
      }
    }

    db.prepare(`
      UPDATE service_orders 
      SET status = ?, startedAt = ?, finishedAt = ?, history = ? 
      WHERE id = ?
    `).run(
      order.status,
      order.startedAt || null,
      order.finishedAt || null,
      JSON.stringify(order.history),
      id
    );

    // Inserir histórico
    const lastEntry = order.history[order.history.length - 1];
    db.prepare(`
      INSERT INTO service_order_history (orderId, status, userId, timestamp, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, lastEntry.status, lastEntry.userId, lastEntry.timestamp, lastEntry.note || null);

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/registry/:type - Salvar/Atualizar registro
app.post('/api/registry/:type', (req, res) => {
  try {
    const { type } = req.params;
    const item = req.body;

    const id = item.id || `${type.charAt(0)}-${Date.now()}`;
    const newItem = { ...item, id };

    const tableMap = {
      companies: 'companies',
      units: 'units',
      sectors: 'sectors',
      beds: 'beds',
      services: 'services',
      actions: 'actions',
      users: 'users',
      teams: 'teams',
      complementItems: 'complement_items',
      orders: 'service_orders'
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return res.status(400).json({ error: `Tipo de registro desconhecido: ${type}` });
    }

    // Verificar se já existe
    const existing = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);

    if (existing) {
      // Atualizar
      if (type === 'companies') {
        db.prepare('UPDATE companies SET name = ?, cnpj = ? WHERE id = ?')
          .run(newItem.name, newItem.cnpj, id);
      } else if (type === 'units') {
        db.prepare('UPDATE units SET name = ?, companyId = ? WHERE id = ?')
          .run(newItem.name, newItem.companyId, id);
      } else if (type === 'sectors') {
        db.prepare('UPDATE sectors SET name = ?, unitId = ? WHERE id = ?')
          .run(newItem.name, newItem.unitId, id);
      } else if (type === 'beds') {
        db.prepare('UPDATE beds SET name = ?, sectorId = ?, status = ? WHERE id = ?')
          .run(newItem.name, newItem.sectorId, newItem.status, id);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.prepare('UPDATE services SET name = ?, companyId = ?, config = ? WHERE id = ?')
          .run(newItem.name, newItem.companyId, config, id);
      } else if (type === 'actions') {
        db.prepare('UPDATE actions SET serviceId = ?, name = ?, "order" = ? WHERE id = ?')
          .run(newItem.serviceId, newItem.name, newItem.order, id);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        const faceDescriptor = newItem.faceDescriptor ? JSON.stringify(newItem.faceDescriptor) : null;
        db.prepare(`
          UPDATE users 
          SET name = ?, email = ?, login = ?, password = ?, cpf = ?, cpfHash = ?, 
              faceDescriptor = ?, companyId = ?, permissions = ? 
          WHERE id = ?
        `).run(
          newItem.name, newItem.email, newItem.login || null, newItem.password || null,
          newItem.cpf || null, newItem.cpfHash || null, faceDescriptor,
          newItem.companyId, permissions, id
        );
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.prepare('UPDATE teams SET name = ?, companyId = ?, userIds = ? WHERE id = ?')
          .run(newItem.name, newItem.companyId, userIds, id);
      } else if (type === 'complementItems') {
        db.prepare('UPDATE complement_items SET name = ?, unitCost = ?, companyId = ? WHERE id = ?')
          .run(newItem.name, newItem.unitCost, newItem.companyId, id);
      }
    } else {
      // Inserir
      if (type === 'companies') {
        db.prepare('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)')
          .run(id, newItem.name, newItem.cnpj);
      } else if (type === 'units') {
        db.prepare('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)')
          .run(id, newItem.name, newItem.companyId);
      } else if (type === 'sectors') {
        db.prepare('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)')
          .run(id, newItem.name, newItem.unitId);
      } else if (type === 'beds') {
        db.prepare('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)')
          .run(id, newItem.name, newItem.sectorId, newItem.status);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.prepare('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)')
          .run(id, newItem.name, newItem.companyId, config);
      } else if (type === 'actions') {
        db.prepare('INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)')
          .run(id, newItem.serviceId, newItem.name, newItem.order);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        const faceDescriptor = newItem.faceDescriptor ? JSON.stringify(newItem.faceDescriptor) : null;
        db.prepare(`
          INSERT INTO users 
          (id, name, email, login, password, cpf, cpfHash, faceDescriptor, companyId, permissions) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, newItem.name, newItem.email, newItem.login || null, newItem.password || null,
          newItem.cpf || null, newItem.cpfHash || null, faceDescriptor,
          newItem.companyId, permissions
        );
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.prepare('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)')
          .run(id, newItem.name, newItem.companyId, userIds);
      } else if (type === 'complementItems') {
        db.prepare('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)')
          .run(id, newItem.name, newItem.unitCost, newItem.companyId);
      }
    }

    res.json(newItem);
  } catch (error) {
    console.error('Error saving registry:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/registry/:type/:id - Deletar registro
app.delete('/api/registry/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;

    const tableMap = {
      companies: 'companies',
      units: 'units',
      sectors: 'sectors',
      beds: 'beds',
      services: 'services',
      actions: 'actions',
      users: 'users',
      teams: 'teams',
      complementItems: 'complement_items',
      orders: 'service_orders'
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return res.status(400).json({ error: `Tipo de registro desconhecido: ${type}` });
    }

    db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting registry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed inicial de dados
function seedInitialData() {
  // Verificar se já existem dados
  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get();
  if (companyCount.count > 0) {
    console.log('📊 Banco de dados já possui dados. Pulando seed.');
    return;
  }

  console.log('🌱 Populando banco de dados com dados iniciais...');

  // Dados iniciais (mesmos do constants.ts)
  const INITIAL_COMPANY = {
    id: 'c1',
    name: 'Hospital Central de Diagnóstico',
    cnpj: '12.345.678/0001-99'
  };

  const INITIAL_UNITS = [
    { id: 'un-1', name: 'Unidade de Internação', companyId: 'c1' },
    { id: 'un-2', name: 'Pronto Atendimento', companyId: 'c1' }
  ];

  const INITIAL_SECTORS = [
    { id: 'st-1', name: 'UTI Adulto', unitId: 'un-1' },
    { id: 'st-2', name: 'Enfermaria A', unitId: 'un-1' }
  ];

  const INITIAL_BEDS = [
    { id: 'bd-1', name: 'Leito 101', sectorId: 'st-1', status: 'OCUPADO' },
    { id: 'bd-2', name: 'Leito 102', sectorId: 'st-1', status: 'AGUARDANDO_ALTA' },
    { id: 'bd-3', name: 'Leito 201', sectorId: 'st-2', status: 'DISPONIVEL' }
  ];

  const INITIAL_SERVICES = [
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

  const MOCK_USERS = [
    {
      id: 'u1',
      name: 'Administrador do Sistema',
      email: 'admin@higi-bed.com.br',
      login: 'ADMIN',
      password: 'ADMIN',
      cpf: '00000000000',
      cpfHash: '645a8aca5a5b84527c57ee2f153f1946',
      companyId: 'c1',
      permissions: {
        pages: ['dashboard', 'solicitar', 'ordens', 'cadastros'],
        modules: ['all'],
        isAdmin: true
      }
    },
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

  const INITIAL_TEAMS = [
    { id: 'tm-1', name: 'Equipe de Higiene Terminal', companyId: 'c1', userIds: ['u2'] },
    { id: 'tm-2', name: 'Equipe de Rouparia/Enxoval', companyId: 'c1', userIds: ['u3'] }
  ];

  const INITIAL_COMPLEMENT_ITEMS = [
    { id: 'it-1', name: 'Kit Higiene Padrão', unitCost: 15.50, companyId: 'c1' },
    { id: 'it-2', name: 'Kit Higiene Premium (Desinfecção)', unitCost: 45.00, companyId: 'c1' },
    { id: 'it-3', name: 'Kit Enxoval Solteiro', unitCost: 22.00, companyId: 'c1' },
    { id: 'it-4', name: 'Kit Enxoval Casal/Especial', unitCost: 35.00, companyId: 'c1' },
    { id: 'it-5', name: 'Reparo de Ar Condicionado (Hora)', unitCost: 120.00, companyId: 'c1' }
  ];

  // Inserir dados
  db.prepare('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)')
    .run(INITIAL_COMPANY.id, INITIAL_COMPANY.name, INITIAL_COMPANY.cnpj);

  INITIAL_UNITS.forEach(unit => {
    db.prepare('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)')
      .run(unit.id, unit.name, unit.companyId);
  });

  INITIAL_SECTORS.forEach(sector => {
    db.prepare('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)')
      .run(sector.id, sector.name, sector.unitId);
  });

  INITIAL_BEDS.forEach(bed => {
    db.prepare('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)')
      .run(bed.id, bed.name, bed.sectorId, bed.status);
  });

  INITIAL_SERVICES.forEach(service => {
    const config = service.config ? JSON.stringify(service.config) : null;
    db.prepare('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)')
      .run(service.id, service.name, service.companyId, config);
  });

  MOCK_USERS.forEach(user => {
    const permissions = JSON.stringify(user.permissions);
    db.prepare(`
      INSERT INTO users 
      (id, name, email, login, password, cpf, cpfHash, faceDescriptor, companyId, permissions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id, user.name, user.email, user.login || null, user.password || null,
      user.cpf || null, user.cpfHash || null, null,
      user.companyId, permissions
    );
  });

  INITIAL_TEAMS.forEach(team => {
    const userIds = JSON.stringify(team.userIds);
    db.prepare('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)')
      .run(team.id, team.name, team.companyId, userIds);
  });

  INITIAL_COMPLEMENT_ITEMS.forEach(item => {
    db.prepare('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)')
      .run(item.id, item.name, item.unitCost, item.companyId);
  });

  console.log('✅ Seed inicial concluído!');
}

// Inicializar tabelas
createTables();

// Popular com dados iniciais se necessário
seedInitialData();

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📁 Banco de dados: ${dbPath}`);
});
