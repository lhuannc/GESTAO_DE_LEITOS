import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, ServiceOrder, OSStatus, Team, ComplementItem } from './types';
import { md5, unmaskCPF } from './utils';
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
import {
  initDatabase,
  saveDatabase,
  getDatabase,
  rowToCompany,
  rowToUnit,
  rowToSector,
  rowToBed,
  rowToService,
  rowToAction,
  rowToUser,
  rowToTeam,
  rowToComplementItem,
  rowToServiceOrder
} from './database';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class BackendDB {
  private initialized = false;

  private async ensureInitialized() {
    if (!this.initialized) {
      await initDatabase();
      this.initialized = true;
    }
    return getDatabase()!;
  }

  private getData() {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const companiesResult = db.exec('SELECT * FROM companies');
    const companies = companiesResult.length > 0 ? companiesResult[0].values.map(r => rowToCompany(r)) : [];
    
    const unitsResult = db.exec('SELECT * FROM units');
    const units = unitsResult.length > 0 ? unitsResult[0].values.map(r => rowToUnit(r)) : [];
    
    const sectorsResult = db.exec('SELECT * FROM sectors');
    const sectors = sectorsResult.length > 0 ? sectorsResult[0].values.map(r => rowToSector(r)) : [];
    
    const bedsResult = db.exec('SELECT * FROM beds');
    const beds = bedsResult.length > 0 ? bedsResult[0].values.map(r => rowToBed(r)) : [];
    
    const servicesResult = db.exec('SELECT * FROM services');
    const services = servicesResult.length > 0 ? servicesResult[0].values.map(r => rowToService(r)) : [];
    
    const actionsResult = db.exec('SELECT * FROM actions');
    const actions = actionsResult.length > 0 ? actionsResult[0].values.map(r => rowToAction(r)) : [];
    
    const usersResult = db.exec('SELECT * FROM users');
    const users = usersResult.length > 0 ? usersResult[0].values.map(r => rowToUser(r)) : [];
    
    const teamsResult = db.exec('SELECT * FROM teams');
    const teams = teamsResult.length > 0 ? teamsResult[0].values.map(r => rowToTeam(r)) : [];
    
    const complementItemsResult = db.exec('SELECT * FROM complement_items');
    const complementItems = complementItemsResult.length > 0 ? complementItemsResult[0].values.map(r => rowToComplementItem(r)) : [];
    
    const ordersResult = db.exec('SELECT * FROM service_orders');
    const orders = ordersResult.length > 0 ? ordersResult[0].values.map(r => rowToServiceOrder(r)) : [];

    return {
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
    };
  }

  public getAllDataSync() {
    return this.getData();
  }

  async authenticate(login: string, password: string): Promise<User | null> {
    await delay(500);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
    const stmt = db.prepare('SELECT * FROM users WHERE login = ? AND password = ?');
    stmt.bind([login, password]);
    const result: any[] = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    
    if (result.length > 0) {
      const row = result[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        login: row.login || undefined,
        password: row.password || undefined,
        companyId: row.companyId,
        permissions: JSON.parse(row.permissions)
      };
    }
    return null;
  }

  async createOrdersFromService(requestData: { 
    bedId: string, 
    serviceId: string, 
    userId: string, 
    companyId: string,
    stepsItems?: Record<number, { itemId: string, quantity: number }[]> 
  }) {
    await delay(300);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
    const stmt = db.prepare('SELECT * FROM services WHERE id = ?');
    stmt.bind([requestData.serviceId]);
    const serviceRows: any[] = [];
    while (stmt.step()) {
      serviceRows.push(stmt.getAsObject());
    }
    stmt.free();
    
    if (serviceRows.length === 0) throw new Error("Serviço não encontrado");
    
    const row = serviceRows[0];
    const service: ServiceType = {
      id: row.id,
      name: row.name,
      companyId: row.companyId,
      config: row.config ? JSON.parse(row.config) : undefined
    };
    const groupId = `group-${Date.now()}`;
    const ordersToCreate: ServiceOrder[] = [];

    const processItems = (step: number) => {
      const selections = requestData.stepsItems?.[step] || [];
      const itemsResult = db.exec('SELECT * FROM complement_items');
      const items = itemsResult.length > 0 ? itemsResult[0].values.map((v: any) => rowToComplementItem(v)) : [];
      
      return selections.map(sel => {
        const item = items.find((i: ComplementItem) => i.id === sel.itemId);
        return {
          itemId: sel.itemId,
          name: item?.name || 'Item desconhecido',
          quantity: sel.quantity,
          unitCost: item?.unitCost || 0
        };
      });
    };

    if (service.config?.generateMultipleOS && service.config.subOrders?.length) {
      service.config.subOrders.forEach((sub, index) => {
        const initialStatus: OSStatus = index === 0 ? 'PENDENTE' : 'BLOQUEADO';
        const orderId = `so-${Date.now()}-${index}`;
        
        const order: ServiceOrder = {
          id: orderId,
          groupId,
          bedId: requestData.bedId,
          serviceId: requestData.serviceId,
          requesterUserId: requestData.userId,
          subServiceName: sub.name,
          step: index,
          currentActionId: '',
          responsibleUserId: null,
          assignedTeamId: sub.targetTeamId,
          companyId: requestData.companyId,
          requestedAt: new Date().toISOString(),
          status: initialStatus,
          items: processItems(index),
          history: [{
            status: initialStatus,
            userId: requestData.userId,
            timestamp: new Date().toISOString(),
            note: index === 0 ? 'Fluxo iniciado.' : 'Aguardando dependência.'
          }]
        };

        ordersToCreate.push(order);
        
        db.run(
          `INSERT INTO service_orders 
          (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
           responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ]
        );
      });
    } else {
      const orderId = `so-${Date.now()}`;
      const order: ServiceOrder = {
        id: orderId,
        groupId,
        bedId: requestData.bedId,
        serviceId: requestData.serviceId,
        requesterUserId: requestData.userId,
        step: 0,
        currentActionId: '',
        responsibleUserId: null,
        companyId: requestData.companyId,
        requestedAt: new Date().toISOString(),
        status: 'PENDENTE',
        items: processItems(0),
        history: [{
          status: 'PENDENTE',
          userId: requestData.userId,
          timestamp: new Date().toISOString()
        }]
      };

      ordersToCreate.push(order);
      
      db.run(
        `INSERT INTO service_orders 
        (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
         responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );
    }

    // Atualizar status do leito
    db.run('UPDATE beds SET status = ? WHERE id = ?', ['HIGIENIZACAO', requestData.bedId]);
    
    saveDatabase(db);
    return ordersToCreate;
  }

  async assignOrder(orderId: string, userId: string) {
    await delay(100);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
    const stmt = db.prepare('SELECT * FROM service_orders WHERE id = ?');
    stmt.bind([orderId]);
    const result: any[] = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    
    if (result.length === 0) return null;
    
    const row = result[0];
    const order = {
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
    } as ServiceOrder;
    order.responsibleUserId = userId;
    order.history.push({
      status: order.status,
      userId,
      timestamp: new Date().toISOString(),
      note: 'OS assumida pelo usuário.'
    });

    db.run(
      `UPDATE service_orders 
       SET responsibleUserId = ?, history = ? 
       WHERE id = ?`,
      [userId, JSON.stringify(order.history), orderId]
    );
    
    saveDatabase(db);
    return order;
  }

  async unassignOrder(orderId: string, adminUserId: string) {
    await delay(100);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
    const stmt = db.prepare('SELECT * FROM service_orders WHERE id = ?');
    stmt.bind([orderId]);
    const result: any[] = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    
    if (result.length === 0) return null;
    
    const row = result[0];
    const order = {
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
    } as ServiceOrder;
    order.responsibleUserId = null;
    order.history.push({
      status: order.status,
      userId: adminUserId,
      timestamp: new Date().toISOString(),
      note: 'Responsável removido por Administrador.'
    });

    db.run(
      `UPDATE service_orders 
       SET responsibleUserId = ?, history = ? 
       WHERE id = ?`,
      [null, JSON.stringify(order.history), orderId]
    );
    
    saveDatabase(db);
    return order;
  }

  async updateOrderStatus(orderId: string, status: OSStatus, userId: string, note?: string) {
    await delay(100);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
    const stmt = db.prepare('SELECT * FROM service_orders WHERE id = ?');
    stmt.bind([orderId]);
    const result: any[] = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    
    if (result.length === 0) return null;
    
    const row = result[0];
    const order = {
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
    } as ServiceOrder;
    
    if (status === 'BLOQUEADO' && order.status !== 'BLOQUEADO') return order;

    if (status === 'EM_ANDAMENTO' && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    }
    
    if (status === 'CONCLUIDO') {
      order.finishedAt = new Date().toISOString();
      
      // Buscar próxima ordem bloqueada do mesmo grupo
      const nextStmt = db.prepare('SELECT * FROM service_orders WHERE groupId = ? AND step = ? AND status = ?');
      nextStmt.bind([order.groupId, order.step + 1, 'BLOQUEADO']);
      const nextOrderRows: any[] = [];
      while (nextStmt.step()) {
        nextOrderRows.push(nextStmt.getAsObject());
      }
      nextStmt.free();
      
      if (nextOrderRows.length > 0) {
        const nextRow = nextOrderRows[0];
        const nextOrder = {
          id: nextRow.id,
          groupId: nextRow.groupId,
          bedId: nextRow.bedId,
          serviceId: nextRow.serviceId,
          requesterUserId: nextRow.requesterUserId,
          subServiceName: nextRow.subServiceName || undefined,
          step: nextRow.step,
          currentActionId: nextRow.currentActionId,
          responsibleUserId: nextRow.responsibleUserId || null,
          assignedTeamId: nextRow.assignedTeamId || undefined,
          companyId: nextRow.companyId,
          requestedAt: nextRow.requestedAt,
          startedAt: nextRow.startedAt || undefined,
          finishedAt: nextRow.finishedAt || undefined,
          status: nextRow.status,
          items: JSON.parse(nextRow.items),
          history: JSON.parse(nextRow.history)
        } as ServiceOrder;
        nextOrder.status = 'PENDENTE';
        nextOrder.history.push({
          status: 'PENDENTE',
          userId: 'system',
          timestamp: new Date().toISOString(),
          note: 'Liberado automaticamente.'
        });

        db.run(
          `UPDATE service_orders 
           SET status = ?, history = ? 
           WHERE id = ?`,
          ['PENDENTE', JSON.stringify(nextOrder.history), nextOrder.id]
        );
      }
    }

    order.status = status;
    order.history.push({ status, userId, timestamp: new Date().toISOString(), note });

    if (status === 'CONCLUIDO') {
      // Verificar se há outras ordens ativas para o mesmo leito
      const otherStmt = db.prepare('SELECT * FROM service_orders WHERE bedId = ? AND id != ? AND status != ?');
      otherStmt.bind([order.bedId, orderId, 'CONCLUIDO']);
      const otherOrderRows: any[] = [];
      while (otherStmt.step()) {
        otherOrderRows.push(otherStmt.getAsObject());
      }
      otherStmt.free();
      
      if (otherOrderRows.length === 0) {
        db.run('UPDATE beds SET status = ? WHERE id = ?', ['DISPONIVEL', order.bedId]);
      }
    }

    db.run(
      `UPDATE service_orders 
       SET status = ?, startedAt = ?, finishedAt = ?, history = ? 
       WHERE id = ?`,
      [
        order.status,
        order.startedAt || null,
        order.finishedAt || null,
        JSON.stringify(order.history),
        orderId
      ]
    );
    
    saveDatabase(db);
    return order;
  }

  async saveRegistry(type: string, item: any) {
    await delay(50);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
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
    if (!tableName) throw new Error(`Tipo de registro desconhecido: ${type}`);

    // Verificar se já existe
    const checkStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
    checkStmt.bind([id]);
    const existing: any[] = [];
    while (checkStmt.step()) {
      existing.push(checkStmt.getAsObject());
    }
    checkStmt.free();
    
    if (existing.length > 0) {
      // Atualizar
      if (type === 'companies') {
        db.run('UPDATE companies SET name = ?, cnpj = ? WHERE id = ?', [newItem.name, newItem.cnpj, id]);
      } else if (type === 'units') {
        db.run('UPDATE units SET name = ?, companyId = ? WHERE id = ?', [newItem.name, newItem.companyId, id]);
      } else if (type === 'sectors') {
        db.run('UPDATE sectors SET name = ?, unitId = ? WHERE id = ?', [newItem.name, newItem.unitId, id]);
      } else if (type === 'beds') {
        db.run('UPDATE beds SET name = ?, sectorId = ?, status = ? WHERE id = ?', [newItem.name, newItem.sectorId, newItem.status, id]);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.run('UPDATE services SET name = ?, companyId = ?, config = ? WHERE id = ?', [newItem.name, newItem.companyId, config, id]);
      } else if (type === 'actions') {
        db.run('UPDATE actions SET serviceId = ?, name = ?, "order" = ? WHERE id = ?', [newItem.serviceId, newItem.name, newItem.order, id]);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        db.run('UPDATE users SET name = ?, email = ?, login = ?, password = ?, cpf = ?, cpfHash = ?, companyId = ?, permissions = ? WHERE id = ?', 
          [newItem.name, newItem.email, newItem.login || null, newItem.password || null, newItem.cpf || null, newItem.cpfHash || null, newItem.companyId, permissions, id]);
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.run('UPDATE teams SET name = ?, companyId = ?, userIds = ? WHERE id = ?', [newItem.name, newItem.companyId, userIds, id]);
      } else if (type === 'complementItems') {
        db.run('UPDATE complement_items SET name = ?, unitCost = ?, companyId = ? WHERE id = ?', [newItem.name, newItem.unitCost, newItem.companyId, id]);
      }
    } else {
      // Inserir
      if (type === 'companies') {
        db.run('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)', [id, newItem.name, newItem.cnpj]);
      } else if (type === 'units') {
        db.run('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)', [id, newItem.name, newItem.companyId]);
      } else if (type === 'sectors') {
        db.run('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)', [id, newItem.name, newItem.unitId]);
      } else if (type === 'beds') {
        db.run('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)', [id, newItem.name, newItem.sectorId, newItem.status]);
      } else if (type === 'services') {
        const config = newItem.config ? JSON.stringify(newItem.config) : null;
        db.run('INSERT INTO services (id, name, companyId, config) VALUES (?, ?, ?, ?)', [id, newItem.name, newItem.companyId, config]);
      } else if (type === 'actions') {
        db.run('INSERT INTO actions (id, serviceId, name, "order") VALUES (?, ?, ?, ?)', [id, newItem.serviceId, newItem.name, newItem.order]);
      } else if (type === 'users') {
        const permissions = JSON.stringify(newItem.permissions);
        db.run('INSERT INTO users (id, name, email, login, password, cpf, cpfHash, companyId, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
          [id, newItem.name, newItem.email, newItem.login || null, newItem.password || null, newItem.cpf || null, newItem.cpfHash || null, newItem.companyId, permissions]);
      } else if (type === 'teams') {
        const userIds = JSON.stringify(newItem.userIds);
        db.run('INSERT INTO teams (id, name, companyId, userIds) VALUES (?, ?, ?, ?)', [id, newItem.name, newItem.companyId, userIds]);
      } else if (type === 'complementItems') {
        db.run('INSERT INTO complement_items (id, name, unitCost, companyId) VALUES (?, ?, ?, ?)', [id, newItem.name, newItem.unitCost, newItem.companyId]);
      }
    }

    saveDatabase(db);
    return newItem;
  }

  async deleteRegistry(type: string, id: string) {
    await delay(50);
    await this.ensureInitialized();
    const db = getDatabase()!;
    
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
    if (!tableName) throw new Error(`Tipo de registro desconhecido: ${type}`);

    db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    saveDatabase(db);
  }

  async getAllData() {
    await delay(50);
    await this.ensureInitialized();
    return this.getData();
  }
}

export const db = new BackendDB();
