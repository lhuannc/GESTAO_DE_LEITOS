// Este arquivo mantido apenas para compatibilidade
// Agora a aplicação usa o backend HTTP (server.js) para acessar SQLite
// Veja backend.ts para a nova implementação

export function initDatabase(): Promise<void> {
  console.warn('initDatabase() não é mais necessário. O backend HTTP gerencia o banco.');
  return Promise.resolve();
}

export function saveDatabase(): void {
  console.warn('saveDatabase() não é mais necessário. O backend HTTP gerencia o banco.');
}

export function getDatabase(): null {
  console.warn('getDatabase() não é mais necessário. Use o backend HTTP através de backend.ts');
  return null;
}

// Funções auxiliares mantidas para compatibilidade (não são mais usadas)
export function rowToCompany(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    cnpj: row[2] as string
  };
}

export function rowToUnit(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string
  };
}

export function rowToSector(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    unitId: row[2] as string
  };
}

export function rowToBed(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    sectorId: row[2] as string,
    status: row[3]
  };
}

export function rowToService(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string,
    config: row[3] ? JSON.parse(row[3] as string) : undefined
  };
}

export function rowToAction(row: any[]): any {
  return {
    id: row[0] as string,
    serviceId: row[1] as string,
    name: row[2] as string,
    order: row[3] as number
  };
}

export function rowToUser(row: any[]): any {
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

export function rowToTeam(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    companyId: row[2] as string,
    userIds: JSON.parse(row[3] as string)
  };
}

export function rowToComplementItem(row: any[]): any {
  return {
    id: row[0] as string,
    name: row[1] as string,
    unitCost: row[2] as number,
    companyId: row[3] as string
  };
}

export function rowToServiceOrder(row: any[]): any {
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
    status: row[14],
    items: JSON.parse(row[15] as string),
    history: JSON.parse(row[16] as string)
  };
}
