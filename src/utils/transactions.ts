import { Transaction } from '../types';

/**
 * Checks if a transaction is an occasional capital outlay / withdrawal that should NOT enter
 * recurring business profitability (e.g. freight/cegonha, vehicle purchase/down payment,
 * occasional consortium adhesion/installment payoff, or technical cash adjustments).
 */
export function isOccasionalAcquisitionTransaction(t?: Partial<Transaction> | null): boolean {
  if (!t || typeof t !== 'object' || t.type !== 'despesa') return false;
  const cat = (t.category || '').toLowerCase().trim();
  const desc = (t.description || '').toLowerCase().trim();
  return (
    cat.includes('consórcio') ||
    cat.includes('consorcio') ||
    cat.includes('aquisição') ||
    cat.includes('aquisicao') ||
    cat.includes('frete') ||
    cat.includes('compra de veículo') ||
    cat.includes('compra veiculo') ||
    cat.includes('ajuste de caixa') ||
    desc.includes('consórcio') ||
    desc.includes('consorcio') ||
    desc.includes('aquisição') ||
    desc.includes('aquisicao') ||
    desc === 'frete' ||
    desc.includes('frete ') ||
    desc.includes(' frete') ||
    desc.includes('cegonha') ||
    desc.includes('compra de veículo') ||
    desc.includes('compra do veículo') ||
    desc.includes('quitação de consórcio') ||
    desc.includes('lance de consórcio') ||
    desc.includes('sgdb sobrescreveu')
  );
}

/**
 * Checks if a transaction is a fixed recurring vehicle/equipment financing installment.
 * Strictly excludes occasional consortium/freight/purchase outlays.
 * Fully defensive against null, undefined, or malformed objects.
 */
export function isFinancingTransaction(t?: Partial<Transaction> | null): boolean {
  if (!t || typeof t !== 'object' || t.type !== 'despesa') return false;
  if (isOccasionalAcquisitionTransaction(t)) return false;
  const cat = (t.category || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  return (
    cat === 'financiamento' ||
    cat.includes('financiamento') ||
    desc.includes('financiamento') ||
    desc.includes('leasing') ||
    desc.includes('cdc banco')
  );
}

/**
 * Checks if a transaction is a fleet maintenance, repair, or parts expense.
 * Strictly excludes financing expenses.
 * Fully defensive against null, undefined, or malformed objects.
 */
export function isMaintenanceTransaction(t?: Partial<Transaction> | null): boolean {
  if (!t || typeof t !== 'object' || t.type !== 'despesa') return false;
  if (isFinancingTransaction(t)) return false;
  const cat = (t.category || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  return (
    cat === 'manutenção' ||
    cat.includes('manuten') ||
    cat === 'revisão' ||
    cat.includes('revis') ||
    cat === 'pneus' ||
    cat.includes('pneu') ||
    cat === 'oficina' ||
    cat.includes('oficina') ||
    cat.includes('peça') ||
    cat.includes('reparo') ||
    desc.includes('manutenção') ||
    desc.includes('manutencao') ||
    desc.includes('revisão') ||
    desc.includes('revisao') ||
    desc.includes('oficina') ||
    desc.includes('pneu') ||
    desc.includes('alinhamento') ||
    desc.includes('balanceamento') ||
    desc.includes('estabilizadora') ||
    desc.includes('pastilha') ||
    desc.includes('óleo') ||
    desc.includes('oleo') ||
    desc.includes('troca') ||
    desc.includes('peça') ||
    desc.includes('eletricista') ||
    desc.includes('mecânic') ||
    desc.includes('mecânica')
  );
}

/**
 * Strictly deduplicates transactions by ID, installment composite key, and exact content.
 * Prevents phantom duplications when background polling or auto-realizing.
 */
export function deduplicateTransactions(transactions?: Transaction[] | null): Transaction[] {
  if (!Array.isArray(transactions)) return [];

  const seenIds = new Set<string>();
  const seenInstallmentKeys = new Set<string>();
  const seenContentKeys = new Set<string>();
  const deduped: Transaction[] = [];

  for (const t of transactions) {
    if (!t || typeof t !== 'object' || !t.id) continue;

    // 1. Exact ID deduplication
    if (seenIds.has(t.id)) continue;
    seenIds.add(t.id);

    // 2. Installment deduplication (e.g. "Parc. 4/32", "Parc. 1/60", etc.)
    const desc = t.description || '';
    const isAutoOrInstallment =
      desc.includes('Parc. ') ||
      desc.includes('Efetivada Automaticamente') ||
      t.id.startsWith('t_auto_fe_') ||
      t.id.startsWith('t_auto_realized_');

    if (isAutoOrInstallment) {
      const match = desc.match(/Parc\.\s*(\d+)\/(\d+)/i);
      if (match) {
        const pNum = match[1];
        const pTotal = match[2];
        const vKey = t.vehicleId || 'none';
        const catKey = (t.category || '').toLowerCase().trim();
        const instKey = `${catKey}_${vKey}_p${pNum}_${pTotal}_${Number(t.value || 0).toFixed(2)}`;
        if (seenInstallmentKeys.has(instKey)) {
          continue; // discard duplicate installment realization
        }
        seenInstallmentKeys.add(instKey);
      }
    }

    // 3. Content deduplication (exact date, type, value, vehicle, normalized description)
    const normDesc = desc.toLowerCase().replace(/\s+/g, ' ').trim();
    const contentKey = `${t.date || ''}_${t.type || ''}_${Number(t.value || 0).toFixed(2)}_${t.vehicleId || 'none'}_${normDesc}`;
    if (seenContentKeys.has(contentKey)) {
      continue; // discard identical duplicate entry
    }
    seenContentKeys.add(contentKey);

    deduped.push(t);
  }

  return deduped;
}
