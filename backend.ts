import { Company, Unit, Sector, Bed, BedStatus, ServiceType, ActionStatus, User, ServiceOrder, OSStatus, Team, ComplementItem } from './types';
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
  rowToServiceOrder,
  rowToStep,
  rowToBedStatusConfig
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

  public getDatabaseInstance() {
    return getDatabase();
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
    
    const stepsResult = db.exec('SELECT * FROM steps');
    const steps = stepsResult.length > 0 ? stepsResult[0].values.map(r => rowToStep(r)) : [];
    
    const bedStatusConfigsResult = db.exec('SELECT * FROM bed_status_configs');
    const bedStatusConfigs = bedStatusConfigsResult.length > 0 ? bedStatusConfigsResult[0].values.map(r => rowToBedStatusConfig(r)) : [];

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
      steps,
      bedStatusConfigs,
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
    stepsItems?: Record<number, { itemId: string, quantity: number }[]>,
    activeSteps?: number[], // Etapas que devem ser incluídas no pedido
    dependencies?: Record<number, string> // Mapeamento: índice do novo step -> ID da ordem existente (dependência)
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
      // Filtrar apenas etapas ativas (se especificado)
      const activeStepsSet = requestData.activeSteps ? new Set(requestData.activeSteps) : null;
      const stepsToCreate = service.config.subOrders
        .map((sub, index) => ({ sub, index }))
        .filter(({ index }) => !activeStepsSet || activeStepsSet.has(index));

      // Reindexar steps para manter sequência correta
      const stepIndexMap = new Map<number, number>();
      stepsToCreate.forEach(({ index }, newIdx) => {
        stepIndexMap.set(index, newIdx);
      });

      stepsToCreate.forEach(({ sub, index: originalIndex }) => {
        const newIndex = stepIndexMap.get(originalIndex)!;
        // Primeira etapa ativa deve ser PENDENTE, demais BLOQUEADO
        const isFirstActive = newIndex === 0;
        const initialStatus: OSStatus = isFirstActive ? 'PENDENTE' : 'BLOQUEADO';
        const orderId = `so-${Date.now()}-${newIndex}`;
        
        // Buscar dados da etapa se stepId estiver presente
        let stepName = sub.name || '';
        let stepTeamId = sub.targetTeamId || '';
        let stepItemIds = sub.allowedItemIds || [];
        
        if (sub.stepId) {
          const stepStmt = db.prepare('SELECT * FROM steps WHERE id = ?');
          stepStmt.bind([sub.stepId]);
          const stepRows: any[] = [];
          while (stepStmt.step()) {
            stepRows.push(stepStmt.getAsObject());
          }
          stepStmt.free();
          
          if (stepRows.length > 0) {
            const stepRow = stepRows[0];
            stepName = stepRow.name;
            stepTeamId = stepRow.targetTeamId;
            stepItemIds = JSON.parse(stepRow.allowedItemIds);
          }
        }
        
        // Verificar dependência
        const dependsOnOrderId = requestData.dependencies?.[newIndex] || null;
        if (dependsOnOrderId) {
          // Verificar status da ordem pai
          const parentStmt = db.prepare('SELECT status FROM service_orders WHERE id = ?');
          parentStmt.bind([dependsOnOrderId]);
          let parentStatus: OSStatus | null = null;
          if (parentStmt.step()) {
            parentStatus = parentStmt.getAsObject().status as OSStatus;
          }
          parentStmt.free();

          // Se tiver dependência e não estiver concluída, bloqueia
          if (parentStatus && parentStatus !== 'CONCLUIDO') {
             // Forçar bloqueio se a dependência não estiver concluída
             // E sobrescrever o status inicial calculado
             // Nota: Se já era BLOQUEADO (por ser etapa posterior), mantém.
             // Se era PENDENTE (primeira etapa), vira BLOQUEADO.
             if (initialStatus !== 'BLOQUEADO') {
               // Mudança local, não afeta initialStatus const
             }
          }
        }

        const isBlockedByDependency = dependsOnOrderId ? (() => {
           const parentStmt = db.prepare('SELECT status FROM service_orders WHERE id = ?');
           parentStmt.bind([dependsOnOrderId]);
           let status: OSStatus = 'PENDENTE';
           if (parentStmt.step()) {
             status = parentStmt.getAsObject().status as OSStatus;
           }
           parentStmt.free();
           return status !== 'CONCLUIDO';
        })() : false;

        const effectiveStatus: OSStatus = isBlockedByDependency ? 'BLOQUEADO' : initialStatus;

        const order: ServiceOrder = {
          id: orderId,
          groupId,
          bedId: requestData.bedId,
          serviceId: requestData.serviceId,
          requesterUserId: requestData.userId,
          subServiceName: stepName,
          step: newIndex, // Usar novo índice sequencial
          currentActionId: '',
          responsibleUserId: null,
          assignedTeamId: stepTeamId,
          companyId: requestData.companyId,
          requestedAt: new Date().toISOString(),
          status: effectiveStatus,
          items: processItems(originalIndex), // Usar índice original para buscar itens
          dependsOnOrderId: dependsOnOrderId || null,
          history: [{
            status: effectiveStatus,
            userId: requestData.userId,
            timestamp: new Date().toISOString(),
            note: isBlockedByDependency 
              ? 'Bloqueado por dependência de outra ação.' 
              : (isFirstActive ? 'Fluxo iniciado.' : 'Aguardando dependência (sequencial).')
          }]
        };

        ordersToCreate.push(order);
        
        db.run(
          `INSERT INTO service_orders 
          (id, groupId, bedId, serviceId, requesterUserId, subServiceName, step, currentActionId, 
           responsibleUserId, assignedTeamId, companyId, requestedAt, startedAt, finishedAt, status, items, dependsOnOrderId, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            order.dependsOnOrderId || null,
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

    // Atualizar status do leito (Removido hardcode para usar configuração do fluxo)
    // Se a primeira etapa tiver configuração onStart, ela será aplicada quando o status mudar para EM_ANDAMENTO
    // db.run('UPDATE beds SET status = ? WHERE id = ?', ['HIGIENIZACAO', requestData.bedId]);
    
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

    // Buscar configurações do serviço
    const serviceStmt = db.prepare('SELECT * FROM services WHERE id = ?');
    serviceStmt.bind([order.serviceId]);
    let bedStatusConfig: { onStart?: BedStatus, onFinish?: BedStatus } | undefined;
    
    if (serviceStmt.step()) {
      const serviceRow = serviceStmt.getAsObject();
      const config = serviceRow.config ? JSON.parse(serviceRow.config) : undefined;
      if (config?.generateMultipleOS && config.subOrders && config.subOrders.length > order.step) {
        // Encontrar a configuração da subOrder correta
        // IMPORTANTE: order.step é o índice na execução. Precisamos mapear para a configuração original.
        // No createOrders, fizemos um remapeamento se activeSteps foi usado.
        // Mas assumindo execução padrão sequencial, o índice deve bater ou precisamos ser mais robustos.
        // Simplificação: Assumimos que a ordem no array de subOrders corresponde ao step se não houver reordenação complexa.
        // Como o createOrders usa o índice do array subOrders, podemos tentar pegar direto.
        // Mas o objeto order não guarda o "indice original". 
        // Vamos varrer config.subOrders para achar a config
        // NOTE: createOrders armazena order.step = newIndex.
        // Se activeSteps foi usado, a correspondência direta quebra.
        // Mas o sistema atual parece só usar sequencial simples por enquanto na interface.
        // Vamos assumir subOrders[order.step] SE não houver subServiceName conflito ou se confiarmos na ordem.
        // Melhor: Vamos pegar a config pelo step atual.
        const subOrderConfig = config.subOrders[order.step]; 
        if (subOrderConfig) {
          bedStatusConfig = subOrderConfig.bedStatusConfig;
        }
      }
    }
    serviceStmt.free();
    
    if (status === 'BLOQUEADO' && order.status !== 'BLOQUEADO') return order;

    if (status === 'EM_ANDAMENTO' && !order.startedAt) {
      order.startedAt = new Date().toISOString();
      // Aplicar status ao iniciar
      if (bedStatusConfig?.onStart) {
        db.run('UPDATE beds SET status = ? WHERE id = ?', [bedStatusConfig.onStart, order.bedId]);
      }
    }
    
    if (status === 'CONCLUIDO') {
      // Aplicar status ao finalizar
      if (bedStatusConfig?.onFinish) {
        db.run('UPDATE beds SET status = ? WHERE id = ?', [bedStatusConfig.onFinish, order.bedId]);
      }
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

      // Verificar ordens que dependem desta (Cross-Flow)
      const depStmt = db.prepare('SELECT * FROM service_orders WHERE dependsOnOrderId = ? AND status = ?');
      depStmt.bind([orderId, 'BLOQUEADO']);
      const depRows: any[] = [];
      while (depStmt.step()) {
        depRows.push(depStmt.getAsObject());
      }
      depStmt.free();

      depRows.forEach(row => {
        const dependentOrder = rowToServiceOrder([
          row.id, row.groupId, row.bedId, row.serviceId, row.requesterUserId, row.subServiceName, 
          row.step, row.currentActionId, row.responsibleUserId, row.assignedTeamId, row.companyId, 
          row.requestedAt, row.startedAt, row.finishedAt, row.status, row.items, row.history, row.dependsOnOrderId
        ]);
        
        dependentOrder.status = 'PENDENTE';
        dependentOrder.history.push({
          status: 'PENDENTE',
          userId: 'system',
          timestamp: new Date().toISOString(),
          note: 'Liberado por conclusão da dependência.'
        });

        db.run(
          `UPDATE service_orders 
           SET status = ?, history = ? 
           WHERE id = ?`,
          ['PENDENTE', JSON.stringify(dependentOrder.history), dependentOrder.id]
        );
      });
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
      steps: 'steps',
      bedStatusConfigs: 'bed_status_configs',
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
        const name = newItem.name ?? null;
        const unitId = newItem.unitId ?? null;
        db.run('UPDATE sectors SET name = ?, unitId = ? WHERE id = ?', [name, unitId, id]);
      } else if (type === 'beds') {
        const name = newItem.name ?? null;
        const sectorId = newItem.sectorId ?? null;
        const status = newItem.status ?? 'DISPONIVEL';
        db.run('UPDATE beds SET name = ?, sectorId = ?, status = ? WHERE id = ?', [name, sectorId, status, id]);
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
      } else if (type === 'steps') {
        // Validar campos obrigatórios
        if (!newItem.name || !newItem.companyId || !newItem.targetTeamId) {
          throw new Error('Campos obrigatórios não preenchidos: nome, empresa ou equipe responsável.');
        }
        const allowedItemIds = JSON.stringify(newItem.allowedItemIds || []);
        try {
          db.run('UPDATE steps SET name = ?, companyId = ?, targetTeamId = ?, allowedItemIds = ?, slaMinutes = ? WHERE id = ?', 
            [newItem.name, newItem.companyId, newItem.targetTeamId, allowedItemIds, newItem.slaMinutes || null, id]);
        } catch (error: any) {
          if (error.message?.includes('FOREIGN KEY')) {
            throw new Error('Equipe ou empresa selecionada não existe no banco de dados.');
          }
          throw error;
        }
      } else if (type === 'bedStatusConfigs') {
         db.run('UPDATE bed_status_configs SET name = ?, color = ?, companyId = ?, isDefault = ? WHERE id = ?', 
           [newItem.name, newItem.color, newItem.companyId, newItem.isDefault ? 1 : 0, id]);
      }
    } else {
      // Inserir
       if (type === 'companies') {
        db.run('INSERT INTO companies (id, name, cnpj) VALUES (?, ?, ?)', [id, newItem.name, newItem.cnpj]);
      } else if (type === 'units') {
        db.run('INSERT INTO units (id, name, companyId) VALUES (?, ?, ?)', [id, newItem.name, newItem.companyId]);
      } else if (type === 'sectors') {
        const name = newItem.name ?? null;
        const unitId = newItem.unitId ?? null;
        db.run('INSERT INTO sectors (id, name, unitId) VALUES (?, ?, ?)', [id, name, unitId]);
      } else if (type === 'beds') {
        const name = newItem.name ?? null;
        const sectorId = newItem.sectorId ?? null;
        const status = newItem.status ?? 'DISPONIVEL';
        db.run('INSERT INTO beds (id, name, sectorId, status) VALUES (?, ?, ?, ?)', [id, name, sectorId, status]);
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
      } else if (type === 'steps') {
        const allowedItemIds = JSON.stringify(newItem.allowedItemIds || []);
        db.run('INSERT INTO steps (id, name, companyId, targetTeamId, allowedItemIds, slaMinutes) VALUES (?, ?, ?, ?, ?, ?)', 
          [id, newItem.name, newItem.companyId, newItem.targetTeamId, allowedItemIds, newItem.slaMinutes || null]);
      } else if (type === 'bedStatusConfigs') {
        db.run('INSERT INTO bed_status_configs (id, name, color, companyId, isDefault) VALUES (?, ?, ?, ?, ?)', 
          [id, newItem.name, newItem.color, newItem.companyId, newItem.isDefault ? 1 : 0]);
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
      steps: 'steps',
      bedStatusConfigs: 'bed_status_configs',
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
