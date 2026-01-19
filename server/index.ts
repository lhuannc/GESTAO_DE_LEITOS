import express from 'express';
import cors from 'cors';
import { getDatabase, rowToCompany, rowToUnit, rowToSector, rowToBed, rowToService, rowToAction, rowToUser, rowToTeam, rowToComplementItem, rowToServiceOrder } from './database.js';
import { ServiceOrder, OSStatus, ServiceType, ComplementItem } from '../types.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Middleware de delay simulado (opcional, pode remover)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// GET /api/data - Buscar todos os dados
app.get('/api/data', async (req, res) => {
  try {
    const db = getDatabase();
    
    const companies = db.prepare('SELECT * FROM companies').all().map(rowToCompany);
    const units = db.prepare('SELECT * FROM units').all().map(rowToUnit);
    const sectors = db.prepare('SELECT * FROM sectors').all().map(rowToSector);
    const beds = db.prepare('SELECT * FROM beds').all().map(rowToBed);
    const services = db.prepare('SELECT * FROM services').all().map(rowToService);
    const actions = db.prepare('SELECT * FROM actions').all().map(rowToAction);
    const users = db.prepare('SELECT * FROM users').all().map(rowToUser);
    const teams = db.prepare('SELECT * FROM teams').all().map(rowToTeam);
    const complementItems = db.prepare('SELECT * FROM complement_items').all().map(rowToComplementItem);
    const orders = db.prepare('SELECT * FROM service_orders').all().map(rowToServiceOrder);

    await delay(50);
    
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
  } catch (error: any) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth - Autenticação
app.post('/api/auth', async (req, res) => {
  try {
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    await delay(500);
    
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE login = ? AND password = ?').get(login, password);
    
    if (!user) {
      return res.status(401).json({ error: 'Login ou senha incorretos' });
    }

    const userData = rowToUser(user);
    // Remover senha da resposta
    delete userData.password;
    
    res.json(userData);
  } catch (error: any) {
    console.error('Erro na autenticação:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders - Criar ordens de serviço
app.post('/api/orders', async (req, res) => {
  try {
    const { bedId, serviceId, userId, companyId, stepsItems } = req.body;
    
    await delay(300);
    
    const db = getDatabase();
    
    // Buscar serviço
    const serviceRow = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!serviceRow) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    
    const service = rowToService(serviceRow) as ServiceType;
    const groupId = `group-${Date.now()}`;
    const ordersToCreate: ServiceOrder[] = [];

    const processItems = (step: number) => {
      const selections = stepsItems?.[step] || [];
      const items = db.prepare('SELECT * FROM complement_items').all().map(rowToComplementItem) as ComplementItem[];
      
      return selections.map((sel: { itemId: string; quantity: number }) => {
        const item = items.find((i: ComplementItem) => i.id === sel.itemId);
        return {
          itemId: sel.itemId,
          name: item?.name || 'Item desconhecido',
          quantity: sel.quantity,
          unitCost: item?.unitCost || 0
        };
      });
    };

    const insertOrder = db.prepare(`
      INSERT INTO service_orders 
      (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
       responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (service.config?.generateMultipleOS && service.config.subOrders?.length) {
      service.config.subOrders.forEach((sub, index) => {
        const initialStatus: OSStatus = index === 0 ? 'PENDENTE' : 'BLOQUEADO';
        const orderId = `so-${Date.now()}-${index}`;
        
        const order: ServiceOrder = {
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

        ordersToCreate.push(order);
        
        insertOrder.run(
          order.id,
          order.groupId,
          order.bedId,
          order.serviceId,
          order.requesterUserId,
          order.subServiceName || null,
          order.step,
          order.currentActionId,
          order.responsibleUserId,
          order.assignedTeamId || null,
          order.companyId,
          order.requestedAt,
          order.startedAt || null,
          order.finishedAt || null,
          order.status,
          JSON.stringify(order.items),
          JSON.stringify(order.history)
        );
      });
    } else {
      const orderId = `so-${Date.now()}`;
      const order: ServiceOrder = {
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

      ordersToCreate.push(order);
      
      insertOrder.run(
        order.id,
        order.groupId,
        order.bedId,
        order.serviceId,
        order.requesterUserId,
        order.subServiceName || null,
        order.step,
        order.currentActionId,
        order.responsibleUserId,
        order.assignedTeamId || null,
        order.companyId,
        order.requestedAt,
        order.startedAt || null,
        order.finishedAt || null,
        order.status,
        JSON.stringify(order.items),
        JSON.stringify(order.history)
      );
    }

    // Atualizar status do leito
    db.prepare('UPDATE beds SET status = ? WHERE id = ?').run('HIGIENIZACAO', bedId);
    
    res.json(ordersToCreate);
  } catch (error: any) {
    console.error('Erro ao criar ordens:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/assign - Atribuir ordem
app.post('/api/orders/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    await delay(100);
    
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }
    
    const order = rowToServiceOrder(row) as ServiceOrder;
    order.responsibleUserId = userId;
    order.history.push({
      status: order.status,
      userId,
      timestamp: new Date().toISOString(),
      note: 'OS assumida pelo usuário.'
    });

    db.prepare('UPDATE service_orders SET responsibleUserId = ?, history = ? WHERE id = ?').run(
      userId,
      JSON.stringify(order.history),
      id
    );
    
    res.json(order);
  } catch (error: any) {
    console.error('Erro ao atribuir ordem:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/unassign - Remover atribuição
app.post('/api/orders/:id/unassign', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;
    
    await delay(100);
    
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }
    
    const order = rowToServiceOrder(row) as ServiceOrder;
    order.responsibleUserId = null;
    order.history.push({
      status: order.status,
      userId: adminUserId,
      timestamp: new Date().toISOString(),
      note: 'Responsável removido por Administrador.'
    });

    db.prepare('UPDATE service_orders SET responsibleUserId = ?, history = ? WHERE id = ?').run(
      null,
      JSON.stringify(order.history),
      id
    );
    
    res.json(order);
  } catch (error: any) {
    console.error('Erro ao remover atribuição:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/orders/:id/status - Atualizar status da ordem
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, userId, note } = req.body;
    
    await delay(100);
    
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id);
    
    if (!row) {
      return res.status(404).json({ error: 'Ordem não encontrada' });
    }
    
    const order = rowToServiceOrder(row) as ServiceOrder;
    
    if (status === 'BLOQUEADO' && order.status !== 'BLOQUEADO') {
      return res.json(order);
    }

    if (status === 'EM_ANDAMENTO' && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    }
    
    if (status === 'CONCLUIDO') {
      order.finishedAt = new Date().toISOString();
      
      // Buscar próxima ordem bloqueada do mesmo grupo
      const nextRow = db.prepare('SELECT * FROM service_orders WHERE groupId = ? AND step = ? AND status = ?')
        .get(order.groupId, order.step + 1, 'BLOQUEADO');
      
      if (nextRow) {
        const nextOrder = rowToServiceOrder(nextRow) as ServiceOrder;
        nextOrder.status = 'PENDENTE';
        nextOrder.history.push({
          status: 'PENDENTE',
          userId: 'system',
          timestamp: new Date().toISOString(),
          note: 'Liberado automaticamente.'
        });

        db.prepare('UPDATE service_orders SET status = ?, history = ? WHERE id = ?').run(
          'PENDENTE',
          JSON.stringify(nextOrder.history),
          nextOrder.id
        );
      }
    }

    order.status = status as OSStatus;
    order.history.push({ status: status as OSStatus, userId, timestamp: new Date().toISOString(), note });

    if (status === 'CONCLUIDO') {
      // Verificar se há outras ordens ativas para o mesmo leito
      const otherOrders = db.prepare('SELECT * FROM service_orders WHERE bedId = ? AND id != ? AND status != ?')
        .all(order.bedId, id, 'CONCLUIDO');
      
      if (otherOrders.length === 0) {
        db.prepare('UPDATE beds SET status = ? WHERE id = ?').run('DISPONIVEL', order.bedId);
      }
    }

    db.prepare('UPDATE service_orders SET status = ?, startedAt = ?, finishedAt = ?, history = ? WHERE id = ?').run(
      order.status,
      order.startedAt || null,
      order.finishedAt || null,
      JSON.stringify(order.history),
      id
    );
    
    res.json(order);
  } catch (error: any) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/registry - Salvar registro (CRUD)
app.post('/api/registry', async (req, res) => {
  try {
    const { type, item } = req.body;
    
    await delay(50);
    
    const db = getDatabase();
    const id = item.id || `${type.charAt(0)}-${Date.now()}`;
    const newItem = { ...item, id };

    const tableMap: Record<string, string> = {
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
        db.prepare('UPDATE companies SET name = ?, cnpj = ? WHERE id = ?').run(newItem.name, newItem.cnpj, id);
      } else if (type === 'units') {
        db.prepare('UPDATE units SET name = ?, companyId = ? WHERE id = ?').run(newItem.name, newItem.companyId, id);
      } else if (type === 'sectors') {
        db.prepare('UPDATE sectors SET name = ?, unitId = ? WHERE id = ?').run(newItem.name, newItem.unitId, id);
      } else if (type === 'beds') {
        db.prepare('UPDATE beds SET name = ?, sectorId = ?, status = ? WHERE id = ?').run(newItem.name, newItem.sectorId, newItem.status, id);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.prepare('UPDATE services SET name = ?, companyId = ?, config = ? WHERE id = ?').run(newItem.name, newItem.companyId, config, id);
      } else if (type === 'actions') {
        db.prepare('UPDATE actions SET serviceId = ?, name = ?, "order" = ? WHERE id = ?').run(newItem.serviceId, newItem.name, newItem.order, id);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        db.prepare('UPDATE users SET name = ?, email = ?, login = ?, password = ?, cpf = ?, cpfHash = ?, companyId = ?, permissions = ? WHERE id = ?').run(
          newItem.name, newItem.email, newItem.login || null, newItem.password || null, newItem.cpf || null, newItem.cpfHash || null, newItem.companyId, permissions, id
        );
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.prepare('UPDATE teams SET name = ?, companyId = ?, userIds = ? WHERE id = ?').run(newItem.name, newItem.companyId, userIds, id);
      } else if (type === 'complementItems') {
        db.prepare('UPDATE complement_items SET name = ?, unitCost = ?, companyId = ? WHERE id = ?').run(newItem.name, newItem.unitCost, newItem.companyId, id);
      }
    } else {
      // Inserir
      if (type === 'companies') {
        db.prepare('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)').run(id, newItem.name, newItem.cnpj);
      } else if (type === 'units') {
        db.prepare('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)').run(id, newItem.name, newItem.companyId);
      } else if (type === 'sectors') {
        db.prepare('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)').run(id, newItem.name, newItem.unitId);
      } else if (type === 'beds') {
        db.prepare('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)').run(id, newItem.name, newItem.sectorId, newItem.status);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.prepare('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)').run(id, newItem.name, newItem.companyId, config);
      } else if (type === 'actions') {
        db.prepare('INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)').run(id, newItem.serviceId, newItem.name, newItem.order);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        db.prepare('INSERT INTO users (id, name, email, login, password, cpf, cpfHash, companyId, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          id, newItem.name, newItem.email, newItem.login || null, newItem.password || null, newItem.cpf || null, newItem.cpfHash || null, newItem.companyId, permissions
        );
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.prepare('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)').run(id, newItem.name, newItem.companyId, userIds);
      } else if (type === 'complementItems') {
        db.prepare('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)').run(id, newItem.name, newItem.unitCost, newItem.companyId);
      }
    }

    res.json(newItem);
  } catch (error: any) {
    console.error('Erro ao salvar registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/registry/:type/:id - Deletar registro
app.delete('/api/registry/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    await delay(50);
    
    const db = getDatabase();
    
    const tableMap: Record<string, string> = {
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
  } catch (error: any) {
    console.error('Erro ao deletar registro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
  console.log(`📁 Banco de dados SQLite: ./data/gestao_leitos.db`);
});
