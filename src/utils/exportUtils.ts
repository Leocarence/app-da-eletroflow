import { Vehicle, Rental, Transaction } from '../types';

/**
 * Formats a number to Brazilian currency string (e.g. "R$ 1.250,00")
 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a date string (YYYY-MM-DD) to Brazilian date format (DD/MM/YYYY)
 */
function formatDateBRL(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Helper to download content as a file in the browser
 */
function downloadCSV(filename: string, csvContent: string) {
  // Add UTF-8 BOM to ensure Excel opens Portuguese accents (ç, á, õ, etc.) correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports a detailed statement for a contract (Rental)
 */
export function exportContractCSV(
  rental: Rental,
  vehicle: Vehicle | undefined,
  transactions: Transaction[],
  totals: { rentReceived: number; depositReceived: number; vehicleExpenses: number }
) {
  const plate = vehicle?.plate || 'Sem Placa';
  const brandModel = vehicle?.brandModel || 'Sem Modelo';
  
  // Build metadata block (Excel compatible with semicolon delimiter in Brazil)
  let csv = 'EXTRATO COMPLETO E DETALHADO DO CONTRATO\n';
  csv += `Locatário;${rental.tenantName}\n`;
  csv += `Telefone;${rental.phone || 'N/D'}\n`;
  csv += `Contrato ID;${rental.id}\n`;
  csv += `Status do Contrato;${rental.status === 'active' ? 'Ativo' : 'Encerrado'}\n`;
  csv += `Período Inicial;De ${formatDateBRL(rental.startDate)} a ${formatDateBRL(rental.endDate)}\n`;
  csv += `Taxa Semanal;${formatBRL(rental.weeklyRate)}\n`;
  csv += `Caução Contratual;${formatBRL(rental.depositValue)}\n`;
  csv += `Veículo;${brandModel} (Placa: ${plate})\n`;
  csv += '\n';
  
  csv += 'RESUMO FINANCEIRO DO PERÍODO\n';
  csv += `Total de Aluguel Recebido;${formatBRL(totals.rentReceived)}\n`;
  csv += `Depósito de Caução Recebido;${formatBRL(totals.depositReceived)}\n`;
  csv += `Total de Custos/Despesas Vinculados;${formatBRL(totals.vehicleExpenses)}\n`;
  csv += `Saldo Líquido no Contrato;${formatBRL(totals.rentReceived + totals.depositReceived - totals.vehicleExpenses)}\n`;
  csv += '\n';

  // Transactions ledger section
  csv += 'DETALHAMENTO DE LANÇAMENTOS FINANCEIROS\n';
  csv += 'Data;Tipo;Valor;Categoria;Descrição\n';
  
  transactions.forEach((t) => {
    const typeLabel = 
      t.type === 'receita' ? 'Aluguel / Receita' :
      t.type === 'despesa' ? 'Despesa / Custo' :
      t.type === 'caucao_recebido' ? 'Caução Entrada' : 'Caução Devolução/Desconto';
      
    csv += `${formatDateBRL(t.date)};${typeLabel};${formatBRL(t.value)};${t.category};${t.description || 'N/D'}\n`;
  });
  
  csv += '\n';

  // Vehicle mileage history associated
  csv += 'HISTÓRICO DE QUILOMETRAGEM E ATUALIZAÇÕES DO VEÍCULO\n';
  csv += 'Data;Quilometragem;Origem;Observações\n';
  
  if (vehicle && vehicle.mileageHistory && vehicle.mileageHistory.length > 0) {
    // Only include entries within the rental period (if completed) or all if active
    const filteredHistory = vehicle.mileageHistory.filter((entry) => {
      if (rental.status === 'completed') {
        return entry.date >= rental.startDate && entry.date <= rental.endDate;
      }
      return entry.date >= rental.startDate;
    });

    if (filteredHistory.length > 0) {
      filteredHistory.forEach((entry) => {
        csv += `${formatDateBRL(entry.date)};${entry.mileage} KM;${entry.source || 'Manual/Cadastro'};${entry.notes || ''}\n`;
      });
    } else {
      csv += `;;;Nenhum registro de alteração de KM no período deste contrato. Quilometragem atual do veículo: ${vehicle.mileage || 'N/D'} KM\n`;
    }
  } else if (vehicle) {
    csv += `;;;Nenhum histórico estruturado disponível. Quilometragem atual do veículo: ${vehicle.mileage || 'N/D'} KM\n`;
  } else {
    csv += ';;;Nenhum veículo associado.\n';
  }

  const cleanTenantName = rental.tenantName.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
  const filename = `extrato_contrato_${cleanTenantName}_${plate}.csv`;
  downloadCSV(filename, csv);
}

/**
 * Exports a detailed statement for a Vehicle
 */
export function exportVehicleCSV(
  vehicle: Vehicle,
  rentals: Rental[],
  transactions: Transaction[],
  financials: { totalRevenues: number; totalExpenses: number; netProfit: number; netDepositInHand: number }
) {
  // Build metadata block
  let csv = 'EXTRATO COMPLETO E DETALHADO DO VEÍCULO\n';
  csv += `Veículo;${vehicle.brandModel}\n`;
  csv += `Placa;${vehicle.plate}\n`;
  csv += `ID do Veículo;${vehicle.id}\n`;
  csv += `Status Atual;${vehicle.status === 'available' ? 'Disponível' : vehicle.status === 'rented' ? 'Alugado' : 'Em Manutenção'}\n`;
  csv += `Valor de Aquisição (Estimado);${vehicle.estimatedValue ? formatBRL(vehicle.estimatedValue) : 'N/D'} (Aferido em: ${vehicle.estimatedValueDate ? formatDateBRL(vehicle.estimatedValueDate) : 'N/D'})\n`;
  csv += `Data de Aquisição/Entrega;${vehicle.acquisitionDate ? formatDateBRL(vehicle.acquisitionDate) : 'N/D'}\n`;
  csv += `Quilometragem Atual (Estimada);${vehicle.mileage ? `${vehicle.mileage.toLocaleString('pt-BR')} KM` : 'N/D'} (Aferido em: ${vehicle.mileageDate ? formatDateBRL(vehicle.mileageDate) : 'N/D'})\n`;
  csv += '\n';

  csv += 'ANÁLISE DE DESEMPENHO FINANCEIRO ACUMULADO\n';
  csv += `Faturamento Total (Aluguéis);${formatBRL(financials.totalRevenues)}\n`;
  csv += `Custos de Manutenção/Oficina;${formatBRL(financials.totalExpenses)}\n`;
  csv += `Depósito de Caução sob Custódia;${formatBRL(financials.netDepositInHand)}\n`;
  csv += `Resultado Financeiro Líquido;${formatBRL(financials.netProfit)}\n`;
  csv += '\n';

  // Rentals history
  const associatedRentals = rentals.filter(r => r.vehicleId === vehicle.id && !r.isDeleted);
  csv += 'HISTÓRICO DE CONTRATOS DE LOCAÇÃO\n';
  csv += 'Locatário;Status;Início;Vencimento/Fim;Taxa Semanal;Caução\n';
  
  if (associatedRentals.length > 0) {
    associatedRentals.forEach(r => {
      csv += `${r.tenantName};${r.status === 'active' ? 'Ativo' : 'Encerrado'};${formatDateBRL(r.startDate)};${formatDateBRL(r.endDate)};${formatBRL(r.weeklyRate)};${formatBRL(r.depositValue)}\n`;
    });
  } else {
    csv += 'Sem contratos registrados para este veículo.\n';
  }
  csv += '\n';

  // Transactions ledger section
  csv += 'DETALHAMENTO DE LANÇAMENTOS FINANCEIROS DO VEÍCULO\n';
  csv += 'Data;Tipo;Valor;Categoria;Descrição\n';
  
  const vehicleTx = transactions
    .filter(t => t.vehicleId === vehicle.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (vehicleTx.length > 0) {
    vehicleTx.forEach((t) => {
      const typeLabel = 
        t.type === 'receita' ? 'Aluguel / Receita' :
        t.type === 'despesa' ? 'Despesa / Custo' :
        t.type === 'caucao_recebido' ? 'Caução Entrada' : 'Caução Devolução/Desconto';
        
      csv += `${formatDateBRL(t.date)};${typeLabel};${formatBRL(t.value)};${t.category};${t.description || 'N/D'}\n`;
    });
  } else {
    csv += 'Nenhum lançamento de caixa registrado para este veículo.\n';
  }
  csv += '\n';

  // Vehicle mileage history log
  csv += 'HISTÓRICO DE ALTERAÇÕES E ATUALIZAÇÕES DE QUILOMETRAGEM\n';
  csv += 'Data;Quilometragem;Tipo/Origem;Observações\n';
  
  if (vehicle.mileageHistory && vehicle.mileageHistory.length > 0) {
    vehicle.mileageHistory.forEach((entry) => {
      csv += `${formatDateBRL(entry.date)};${entry.mileage} KM;${entry.source || 'Alteração manual'};${entry.notes || ''}\n`;
    });
  } else {
    csv += `${vehicle.mileageDate ? formatDateBRL(vehicle.mileageDate) : 'N/D'};${vehicle.mileage || 'N/D'} KM;Leitura Inicial;Quilometragem registrada no cadastro/última aferição.\n`;
  }

  const cleanModel = vehicle.brandModel.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
  const filename = `extrato_veiculo_${cleanModel}_${vehicle.plate}.csv`;
  downloadCSV(filename, csv);
}
