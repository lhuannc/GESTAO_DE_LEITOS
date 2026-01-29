import { prisma } from './client';
import { hash } from 'bcrypt';

async function main() {
  console.log('🌱 Seeding database...');

  // Create company
  const company = await prisma.company.upsert({
    where: { cnpj: '00000000000000' },
    update: {},
    create: {
      name: 'Hospital Central',
      cnpj: '00000000000000',
    },
  });

  console.log('✅ Company created:', company.name);

  // Create unit
  const unit = await prisma.unit.upsert({
    where: { id: 'unit_1' },
    update: {},
    create: {
      id: 'unit_1',
      name: 'Unidade Principal',
      companyId: company.id,
    },
  });

  console.log('✅ Unit created:', unit.name);

  // Create sectors
  const sectors = await Promise.all([
    prisma.sector.upsert({
      where: { id: 'sector_uti' },
      update: {},
      create: {
        id: 'sector_uti',
        name: 'UTI',
        unitId: unit.id,
      },
    }),
    prisma.sector.upsert({
      where: { id: 'sector_emergencia' },
      update: {},
      create: {
        id: 'sector_emergencia',
        name: 'Emergência',
        unitId: unit.id,
      },
    }),
    prisma.sector.upsert({
      where: { id: 'sector_internacao' },
      update: {},
      create: {
        id: 'sector_internacao',
        name: 'Internação',
        unitId: unit.id,
      },
    }),
  ]);

  console.log('✅ Sectors created:', sectors.length);

  // Create beds
  const beds = [];
  for (const sector of sectors) {
    for (let i = 1; i <= 10; i++) {
      const bed = await prisma.bed.create({
        data: {
          name: `Leito ${i}`,
          sectorId: sector.id,
          status: 'DISPONIVEL',
        },
      });
      beds.push(bed);
    }
  }

  console.log('✅ Beds created:', beds.length);

  // Create teams
  const team = await prisma.team.upsert({
    where: { id: 'team_1' },
    update: {},
    create: {
      id: 'team_1',
      name: 'Equipe de Limpeza',
    },
  });

  console.log('✅ Team created:', team.name);

  // Create admin user
  const adminPassword = await hash('admin', 10);
  const admin = await prisma.user.upsert({
    where: { cpf: '11111111111' },
    update: {},
    create: {
      name: 'Administrador',
      cpf: '11111111111',
      email: 'admin@hospital.com',
      login: 'admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  console.log('✅ Admin user created:', admin.name);

  // Create operational user
  const operationalPassword = await hash('operacional', 10);
  const operational = await prisma.user.upsert({
    where: { cpf: '22222222222' },
    update: {},
    create: {
      name: 'Operador',
      cpf: '22222222222',
      email: 'op@hospital.com',
      login: 'operador',
      passwordHash: operationalPassword,
      role: 'OPERACIONAL',
      teamId: team.id,
      companyId: company.id,
    },
  });

  console.log('✅ Operational user created:', operational.name);

  // Create service types
  const serviceTypes = await Promise.all([
    prisma.serviceType.upsert({
      where: { id: 'service_higienizacao' },
      update: {},
      create: {
        id: 'service_higienizacao',
        name: 'Higienização de Leito',
        description: 'Limpeza completa do leito',
        generateMultipleOS: true,
        companyId: company.id,
      },
    }),
    prisma.serviceType.upsert({
      where: { id: 'service_manutencao' },
      update: {},
      create: {
        id: 'service_manutencao',
        name: 'Manutenção de Leito',
        description: 'Manutenção preventiva ou corretiva',
        companyId: company.id,
      },
    }),
  ]);

  console.log('✅ Service types created:', serviceTypes.length);

  // Create steps for higienizacao
  await Promise.all([
    prisma.step.create({
      data: {
        name: 'Retirar roupa de cama',
        order: 1,
        serviceTypeId: 'service_higienizacao',
        targetTeamId: team.id,
        companyId: company.id,
      },
    }),
    prisma.step.create({
      data: {
        name: 'Limpar superfícies',
        order: 2,
        serviceTypeId: 'service_higienizacao',
        targetTeamId: team.id,
        companyId: company.id,
      },
    }),
    prisma.step.create({
      data: {
        name: 'Colocar roupa limpa',
        order: 3,
        serviceTypeId: 'service_higienizacao',
        targetTeamId: team.id,
        companyId: company.id,
      },
    }),
  ]);

  console.log('✅ Steps created for higienizacao');

  // Create bed status configs
  await Promise.all([
    prisma.bedStatusConfig.create({
      data: {
        name: 'Disponível',
        color: '#10b981',
        companyId: company.id,
      },
    }),
    prisma.bedStatusConfig.create({
      data: {
        name: 'Ocupado',
        color: '#ef4444',
        companyId: company.id,
      },
    }),
    prisma.bedStatusConfig.create({
      data: {
        name: 'Em Higienização',
        color: '#f59e0b',
        companyId: company.id,
      },
    }),
    prisma.bedStatusConfig.create({
      data: {
        name: 'Em Manutenção',
        color: '#8b5cf6',
        companyId: company.id,
      },
    }),
  ]);

  console.log('✅ Bed status configs created');

  // Create complement items
  await Promise.all([
    prisma.complementItem.create({
      data: {
        name: 'Kit Cama Solteiro',
        unitCost: 15.50,
        companyId: company.id,
      },
    }),
    prisma.complementItem.create({
      data: {
        name: 'Kit Banho',
        unitCost: 8.00,
        companyId: company.id,
      },
    }),
  ]);

  console.log('✅ Complement items created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: CPF 111.111.111-11 / Senha: admin');
  console.log('   Operacional: CPF 222.222.222-22 / Senha: operacional');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
