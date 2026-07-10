import { Vehicle, Rental, Transaction } from './types';

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'v_dolphin',
    brandModel: 'BYD Dolphin Mini Azul',
    plate: 'TYU-0E16',
    weeklyRate: 1300,
    depositValue: 2600,
    status: 'rented',
    acquisitionDate: '2026-03-23'
  },
  {
    id: 'v_corolla',
    brandModel: 'Toyota Corolla XEI Prata',
    plate: 'ABC-1234',
    weeklyRate: 1500,
    depositValue: 3000,
    status: 'rented',
    acquisitionDate: '2026-02-15'
  },
  {
    id: 'v_onix',
    brandModel: 'Chevrolet Onix LT Branco',
    plate: 'XYZ-9876',
    weeklyRate: 950,
    depositValue: 1900,
    status: 'rented',
    acquisitionDate: '2026-03-01'
  },
  {
    id: 'v_mobi',
    brandModel: 'Fiat Mobi Trekking Preto',
    plate: 'QWE-4567',
    weeklyRate: 750,
    depositValue: 1500,
    status: 'available',
    acquisitionDate: '2026-05-20'
  }
];

export const INITIAL_RENTALS: Rental[] = [
  {
    id: 'r_dolphin',
    vehicleId: 'v_dolphin',
    tenantName: 'LEANDRO',
    phone: '(11) 99313-1616',
    startDate: '2026-03-25',
    endDate: '2027-03-24',
    weeklyRate: 1300,
    depositValue: 2600,
    status: 'active'
  },
  {
    id: 'r_corolla',
    vehicleId: 'v_corolla',
    tenantName: 'MARCELO SILVEIRA',
    phone: '(21) 98765-4321',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    weeklyRate: 1500,
    depositValue: 3000,
    status: 'active'
  },
  {
    id: 'r_onix',
    vehicleId: 'v_onix',
    tenantName: 'SABRINA SANTOS',
    phone: '(31) 99123-4567',
    startDate: '2026-05-15',
    endDate: '2026-08-13',
    weeklyRate: 950,
    depositValue: 1900,
    status: 'active'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // --- BYD DOLPHIN MINI AZUL ---
  {
    id: 't_d_c1',
    date: '2026-03-25',
    type: 'caucao_recebido',
    value: 2600,
    vehicleId: 'v_dolphin',
    category: 'Depósito de Garantia',
    description: 'Caução recebido - Leandro (Dolphin Mini)'
  },
  {
    id: 't_d_r1',
    date: '2026-04-01',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 1 (Abril) - LEANDRO'
  },
  {
    id: 't_d_r2',
    date: '2026-04-08',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 2 (Abril) - LEANDRO'
  },
  {
    id: 't_d_r3',
    date: '2026-04-15',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 3 (Abril) - LEANDRO'
  },
  {
    id: 't_d_r4',
    date: '2026-04-23',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 4 (Abril) - LEANDRO'
  },
  {
    id: 't_d_r5',
    date: '2026-05-01',
    type: 'receita',
    value: 1430,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 5 (Abril) Ajustada - LEANDRO'
  },
  {
    id: 't_d_r6',
    date: '2026-05-06',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 1 (Maio) - LEANDRO'
  },
  {
    id: 't_d_r7',
    date: '2026-05-13',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 2 (Maio) - LEANDRO'
  },
  {
    id: 't_d_r8',
    date: '2026-05-20',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 3 (Maio) - LEANDRO'
  },
  {
    id: 't_d_r9',
    date: '2026-05-29',
    type: 'receita',
    value: 1430,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 4 (Maio) Ajustada - LEANDRO'
  },
  {
    id: 't_d_r10',
    date: '2026-06-03',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 1 (Junho) - LEANDRO'
  },
  {
    id: 't_d_r11',
    date: '2026-06-10',
    type: 'receita',
    value: 1300,
    vehicleId: 'v_dolphin',
    category: 'Aluguel Semanal',
    description: 'Semana 2 (Junho) - LEANDRO'
  },
  {
    id: 't_d_m1',
    date: '2026-03-24',
    type: 'despesa',
    value: 399,
    vehicleId: 'v_dolphin',
    category: 'Manutenção',
    description: 'INSULFILME'
  },
  {
    id: 't_d_s1',
    date: '2026-04-09',
    type: 'despesa',
    value: 791,
    vehicleId: 'v_dolphin',
    category: 'Seguro',
    description: 'SEGURO (1-10)'
  },
  {
    id: 't_d_i1',
    date: '2026-04-15',
    type: 'despesa',
    value: 1264.88,
    vehicleId: 'v_dolphin',
    category: 'Impostos/Taxas',
    description: 'IPVA 1ª PARCELA'
  },
  {
    id: 't_d_f1',
    date: '2026-04-16',
    type: 'despesa',
    value: 1655.74,
    vehicleId: 'v_dolphin',
    category: 'Financiamento',
    description: 'FINANCIAMENTO (1-36)'
  },
  {
    id: 't_d_s2',
    date: '2026-05-08',
    type: 'despesa',
    value: 791,
    vehicleId: 'v_dolphin',
    category: 'Seguro',
    description: 'SEGURO (2-10)'
  },
  {
    id: 't_d_i2',
    date: '2026-05-15',
    type: 'despesa',
    value: 1264.88,
    vehicleId: 'v_dolphin',
    category: 'Impostos/Taxas',
    description: 'IPVA 2ª PARCELA'
  },
  {
    id: 't_d_f2',
    date: '2026-05-16',
    type: 'despesa',
    value: 1655.74,
    vehicleId: 'v_dolphin',
    category: 'Financiamento',
    description: 'FINANCIAMENTO (2-36)'
  },

  // --- TOYOTA COROLLA ---
  {
    id: 't_c_c1',
    date: '2026-04-01',
    type: 'caucao_recebido',
    value: 3000,
    vehicleId: 'v_corolla',
    category: 'Depósito de Garantia',
    description: 'Caução recebido - Marcelo'
  },
  {
    id: 't_c_r1',
    date: '2026-04-08',
    type: 'receita',
    value: 1500,
    vehicleId: 'v_corolla',
    category: 'Aluguel Semanal',
    description: 'Semana 1 - MARCELO'
  },
  {
    id: 't_c_r2',
    date: '2026-04-15',
    type: 'receita',
    value: 1500,
    vehicleId: 'v_corolla',
    category: 'Aluguel Semanal',
    description: 'Semana 2 - MARCELO'
  },
  {
    id: 't_c_r3',
    date: '2026-04-22',
    type: 'receita',
    value: 1500,
    vehicleId: 'v_corolla',
    category: 'Aluguel Semanal',
    description: 'Semana 3 - MARCELO'
  },
  {
    id: 't_c_r4',
    date: '2026-04-29',
    type: 'receita',
    value: 1500,
    vehicleId: 'v_corolla',
    category: 'Aluguel Semanal',
    description: 'Semana 4 - MARCELO'
  },
  {
    id: 't_c_r5',
    date: '2026-05-06',
    type: 'receita',
    value: 1500,
    vehicleId: 'v_corolla',
    category: 'Aluguel Semanal',
    description: 'Semana 5 - MARCELO'
  },
  {
    id: 't_c_m1',
    date: '2026-04-10',
    type: 'despesa',
    value: 450,
    vehicleId: 'v_corolla',
    category: 'Manutenção',
    description: 'Troca de Óleo e Filtros'
  },
  {
    id: 't_c_f1',
    date: '2026-04-25',
    type: 'despesa',
    value: 2200,
    vehicleId: 'v_corolla',
    category: 'Financiamento',
    description: 'FINANCIAMENTO COROLLA (1-24)'
  },

  // --- CHEVROLET ONIX ---
  {
    id: 't_o_c1',
    date: '2026-05-15',
    type: 'caucao_recebido',
    value: 1900,
    vehicleId: 'v_onix',
    category: 'Depósito de Garantia',
    description: 'Caução recebido - Sabrina'
  },
  {
    id: 't_o_r1',
    date: '2026-05-22',
    type: 'receita',
    value: 950,
    vehicleId: 'v_onix',
    category: 'Aluguel Semanal',
    description: 'Semana 1 - SABRINA'
  },
  {
    id: 't_o_r2',
    date: '2026-05-29',
    type: 'receita',
    value: 950,
    vehicleId: 'v_onix',
    category: 'Aluguel Semanal',
    description: 'Semana 2 - SABRINA'
  },
  {
    id: 't_o_r3',
    date: '2026-06-05',
    type: 'receita',
    value: 950,
    vehicleId: 'v_onix',
    category: 'Aluguel Semanal',
    description: 'Semana 3 - SABRINA'
  },
  {
    id: 't_o_m1',
    date: '2026-05-18',
    type: 'despesa',
    value: 180,
    vehicleId: 'v_onix',
    category: 'Manutenção',
    description: 'Alinhamento e Balanceamento'
  }
];
