import React, { useState, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { Calendar, TrendingUp, Wallet, CheckSquare, Square, Lock, Minus, Plus } from 'lucide-react';
import { getBrasiliaDateStr, toLocalDateStr } from '../utils/dateUtils';

interface CashFlowChartProps {
  transactions: Transaction[];
}

interface ChartPoint {
  date: string;
  formattedDate: string;
  receitas: number;
  despesas: number;
  caucao: number; // Net caução
  saldoDia: number;
  acumulado: number;
  acumuladoReceitas: number;
  acumuladoDespesas: number;
  acumuladoCaucao: number;
}

export default function CashFlowChart({ transactions }: CashFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 320, height: 240 });
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [chartMode, setChartMode] = useState<'acumulado' | 'diario'>('acumulado');
  const [timeFrame, setTimeFrame] = useState<'diario' | 'semanal' | 'mensal'>('semanal');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date(getBrasiliaDateStr() + 'T00:00:00');
    today.setMonth(today.getMonth() - 3);
    return toLocalDateStr(today);
  });
  const [endDate, setEndDate] = useState<string>(() => getBrasiliaDateStr());

  // Touch/Pinch gesture refs for mobile pinch-to-zoom
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  // Interactive visibility toggles for the chart lines and bars
  const [showReceitas, setShowReceitas] = useState(true);
  const [showDespesas, setShowDespesas] = useState(true);
  const [showSaldo, setShowSaldo] = useState(true);
  const [includeCaucao, setIncludeCaucao] = useState(true);

  // Track parent div resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Floor or Round the values to prevent subpixel layout oscillations at fractional zoom levels
        const roundedWidth = Math.round(entry.contentRect.width);
        const roundedHeight = Math.round(entry.contentRect.height);
        
        setDimensions(prev => {
          const nextWidth = Math.max(roundedWidth, 100);
          const nextHeight = Math.max(roundedHeight, 220);
          
          // Only trigger state updates if the change is significant (>= 6px)
          // this completely breaks infinite zoom/scrollbar oscillation feedback loops
          if (Math.abs(prev.width - nextWidth) >= 6 || Math.abs(prev.height - nextHeight) >= 6) {
            return { width: nextWidth, height: nextHeight };
          }
          return prev;
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute aggregated data points of weekly/monthly cash flow
  const points: ChartPoint[] = React.useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    // Only use transactions up to the custom endDate (or todayStr if blank)
    const activeEndDate = endDate || todayStr;
    const effectiveTransactions = transactions.filter(t => t.date <= activeEndDate);

    if (effectiveTransactions.length === 0) return [];

    // Sort transactions chronologically
    const sorted = [...effectiveTransactions].sort((a, b) => a.date.localeCompare(b.date));

    // Determine the start date based on user's input (or default to 3 months ago if blank)
    let startLimitDate = startDate || null;
    if (!startLimitDate) {
      const today = new Date(todayStr + 'T00:00:00');
      today.setMonth(today.getMonth() - 3);
      startLimitDate = toLocalDateStr(today);
    }

    // Find date range
    let minDateStr = sorted[0].date;
    if (startLimitDate && startLimitDate > minDateStr) {
      minDateStr = startLimitDate;
    }
    
    // Choose active range limits
    const maxDateStr = activeEndDate;

    if (timeFrame === 'semanal') {
      // Helper to find the Monday date (YYYY-MM-DD) for a given date string
      const getMonday = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday adjustments
        const mon = new Date(d.setDate(diff));
        return toLocalDateStr(mon);
      };

      const startMonStr = getMonday(minDateStr);
      const endMonStr = getMonday(maxDateStr);

      const weekMondays: string[] = [];
      let curr = new Date(startMonStr + 'T00:00:00');
      const last = new Date(endMonStr + 'T00:00:00');
      let safety = 0;
      while (curr <= last && safety < 1000) {
        safety++;
        weekMondays.push(toLocalDateStr(curr));
        curr.setDate(curr.getDate() + 7);
      }

      // Aggregate transactions by Monday of the week
      const aggWeekly: Record<string, { receitas: number; despesas: number; caucao: number }> = {};
      weekMondays.forEach(m => {
        aggWeekly[m] = { receitas: 0, despesas: 0, caucao: 0 };
      });

      let runningCentral = 0;
      let runningEscrow = 0;
      let runningReceitas = 0;
      let runningDespesas = 0;

      effectiveTransactions.forEach(t => {
        const m = getMonday(t.date);
        if (aggWeekly[m]) {
          if (t.type === 'receita') aggWeekly[m].receitas += t.value;
          else if (t.type === 'despesa') aggWeekly[m].despesas += t.value;
          else if (t.type === 'caucao_recebido') aggWeekly[m].caucao += t.value;
          else if (t.type === 'caucao_devolvido') aggWeekly[m].caucao -= t.value;
        } else {
          // If it's before our start date, accumulate into running initial totals
          if (m < startMonStr) {
            if (t.type === 'receita') {
              runningReceitas += t.value;
              runningCentral += t.value;
            } else if (t.type === 'despesa') {
              runningDespesas += t.value;
              runningCentral -= t.value;
            } else if (t.type === 'caucao_recebido') {
              runningEscrow += t.value;
            } else if (t.type === 'caucao_devolvido') {
              runningEscrow -= t.value;
            }
          }
        }
      });

      const computedWeeks: ChartPoint[] = weekMondays.map(m => {
        const data = aggWeekly[m] || { receitas: 0, despesas: 0, caucao: 0 };
        const netCaucao = data.caucao;
        
        runningReceitas += data.receitas;
        runningDespesas += data.despesas;
        runningCentral += (data.receitas - data.despesas);
        runningEscrow += netCaucao;
        const runningTotal = runningCentral + (includeCaucao ? runningEscrow : 0);

        const parts = m.split('-');
        const formattedDate = `${parts[2]}/${parts[1]}`;

        return {
          date: m,
          formattedDate,
          receitas: data.receitas,
          despesas: data.despesas,
          caucao: netCaucao,
          saldoDia: data.receitas - data.despesas + (includeCaucao ? netCaucao : 0),
          acumulado: runningTotal,
          acumuladoReceitas: runningReceitas,
          acumuladoDespesas: runningDespesas,
          acumuladoCaucao: runningEscrow
        };
      });

      return computedWeeks;
    } else if (timeFrame === 'diario') {
      // Find all days on which there were financial transactions
      const aggDaily: Record<string, { receitas: number; despesas: number; caucao: number }> = {};
      
      effectiveTransactions.forEach(t => {
        const d = t.date; // YYYY-MM-DD
        if (!aggDaily[d]) {
          aggDaily[d] = { receitas: 0, despesas: 0, caucao: 0 };
        }
        if (t.type === 'receita') aggDaily[d].receitas += t.value;
        else if (t.type === 'despesa') aggDaily[d].despesas += t.value;
        else if (t.type === 'caucao_recebido') aggDaily[d].caucao += t.value;
        else if (t.type === 'caucao_devolvido') aggDaily[d].caucao -= t.value;
      });

      const activeDates = Object.keys(aggDaily).sort();

      let runningCentral = 0;
      let runningEscrow = 0;
      let runningReceitas = 0;
      let runningDespesas = 0;

      const filteredDates = startLimitDate
        ? activeDates.filter(d => d >= startLimitDate)
        : activeDates;

      activeDates.forEach(d => {
        if (startLimitDate && d < startLimitDate) {
          const data = aggDaily[d];
          runningReceitas += data.receitas;
          runningDespesas += data.despesas;
          runningCentral += (data.receitas - data.despesas);
          runningEscrow += data.caucao;
        }
      });

      const computedDaily: ChartPoint[] = filteredDates.map(d => {
        const data = aggDaily[d];
        const netCaucao = data.caucao;
        
        runningReceitas += data.receitas;
        runningDespesas += data.despesas;
        runningCentral += (data.receitas - data.despesas);
        runningEscrow += netCaucao;
        const runningTotal = runningCentral + (includeCaucao ? runningEscrow : 0);

        const parts = d.split('-'); // YYYY-MM-DD
        const formattedDate = `${parts[2]}/${parts[1]}`; // DD/MM

        return {
          date: d,
          formattedDate,
          receitas: data.receitas,
          despesas: data.despesas,
          caucao: netCaucao,
          saldoDia: data.receitas - data.despesas + (includeCaucao ? netCaucao : 0),
          acumulado: runningTotal,
          acumuladoReceitas: runningReceitas,
          acumuladoDespesas: runningDespesas,
          acumuladoCaucao: runningEscrow
        };
      });

      return computedDaily;
    } else {
      // Monthly mode
      const getYearMonth = (dateStr: string) => dateStr.substring(0, 7); // "YYYY-MM"
      const startYM = getYearMonth(minDateStr);
      const endYM = getYearMonth(maxDateStr);

      const monthYMs: string[] = [];
      let [startYear, startMonth] = startYM.split('-').map(Number);
      const [endYear, endMonth] = endYM.split('-').map(Number);

      let curY = startYear;
      let curM = startMonth;
      let safety = 0;
      while ((curY < endYear || (curY === endYear && curM <= endMonth)) && safety < 1000) {
        safety++;
        monthYMs.push(`${curY}-${String(curM).padStart(2, '0')}`);
        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }

      // Aggregate transactions by year-month
      const aggMonthly: Record<string, { receitas: number; despesas: number; caucao: number }> = {};
      monthYMs.forEach(ym => {
        aggMonthly[ym] = { receitas: 0, despesas: 0, caucao: 0 };
      });

      let runningCentral = 0;
      let runningEscrow = 0;
      let runningReceitas = 0;
      let runningDespesas = 0;

      effectiveTransactions.forEach(t => {
        const ym = t.date.substring(0, 7);
        if (aggMonthly[ym]) {
          if (t.type === 'receita') aggMonthly[ym].receitas += t.value;
          else if (t.type === 'despesa') aggMonthly[ym].despesas += t.value;
          else if (t.type === 'caucao_recebido') aggMonthly[ym].caucao += t.value;
          else if (t.type === 'caucao_devolvido') aggMonthly[ym].caucao -= t.value;
        } else {
          // If before start month
          if (ym < startYM) {
            if (t.type === 'receita') {
              runningReceitas += t.value;
              runningCentral += t.value;
            } else if (t.type === 'despesa') {
              runningDespesas += t.value;
              runningCentral -= t.value;
            } else if (t.type === 'caucao_recebido') {
              runningEscrow += t.value;
            } else if (t.type === 'caucao_devolvido') {
              runningEscrow -= t.value;
            }
          }
        }
      });

      const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const computedMonths: ChartPoint[] = monthYMs.map(ym => {
        const data = aggMonthly[ym] || { receitas: 0, despesas: 0, caucao: 0 };
        const netCaucao = data.caucao;
        
        runningReceitas += data.receitas;
        runningDespesas += data.despesas;
        runningCentral += (data.receitas - data.despesas);
        runningEscrow += netCaucao;
        const runningTotal = runningCentral + (includeCaucao ? runningEscrow : 0);

        const [year, month] = ym.split('-');
        const monthIndex = Number(month);
        const formattedDate = `${MONTH_NAMES[monthIndex - 1]}/${year.substring(2)}`;

        return {
          date: ym,
          formattedDate,
          receitas: data.receitas,
          despesas: data.despesas,
          caucao: netCaucao,
          saldoDia: data.receitas - data.despesas + (includeCaucao ? netCaucao : 0),
          acumulado: runningTotal,
          acumuladoReceitas: runningReceitas,
          acumuladoDespesas: runningDespesas,
          acumuladoCaucao: runningEscrow
        };
      });

      return computedMonths;
    }
  }, [transactions, timeFrame, includeCaucao, startDate, endDate]);

  // Calculate SVG Drawing coordinates
  const paddingLeft = 65;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  // Let the chart width expand dynamically with zoom Level
  const totalWidth = Math.max(dimensions.width, 320) * zoomLevel;
  const chartWidth = totalWidth - paddingLeft - paddingRight;
  const chartHeight = dimensions.height - paddingTop - paddingBottom;

  // Max and min values for cumulative scale based on toggled inputs
  const minCum = React.useMemo(() => {
    if (points.length === 0) return 0;
    const values: number[] = [0];
    points.forEach(p => {
      if (showSaldo) {
        values.push(p.acumulado);
      }
      if (showReceitas) {
        values.push(p.acumuladoReceitas);
      }
      if (showDespesas) {
        values.push(p.acumuladoDespesas);
      }
    });
    return Math.min(...values);
  }, [points, showReceitas, showDespesas, showSaldo]);

  const maxCum = React.useMemo(() => {
    if (points.length === 0) return 1000;
    const values: number[] = [1000];
    points.forEach(p => {
      if (showSaldo) {
        values.push(p.acumulado);
      }
      if (showReceitas) {
        values.push(p.acumuladoReceitas);
      }
      if (showDespesas) {
        values.push(p.acumuladoDespesas);
      }
    });
    return Math.max(...values);
  }, [points, showReceitas, showDespesas, showSaldo]);

  // If there are no points, render placeholder
  if (points.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 p-6 shadow-premium transition-all">
        <Wallet className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
        <p className="text-slate-500 font-medium text-sm text-center">Nenhum dado financeiro para exibir o gráfico.</p>
        <p className="text-slate-400 text-xs mt-1 text-center">Insira receitas, despesas ou cauções para gerar o fluxo.</p>
      </div>
    );
  }

  const deltaCum = maxCum - minCum === 0 ? 1 : maxCum - minCum;

  // Max daily values for bar scale (Receitas & Despesas indicator)
  const maxDaily = Math.max(...points.map(p => {
    const vals: number[] = [];
    if (showReceitas) vals.push(p.receitas);
    if (showDespesas) vals.push(p.despesas);
    if (includeCaucao) vals.push(Math.abs(p.caucao));
    return vals.length > 0 ? Math.max(...vals) : 0;
  }), 200);

  // SVG coordinates converter
  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const ratio = (val - minCum) / deltaCum;
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  const getBarHeight = (val: number) => {
    return (val / maxDaily) * (chartHeight * 0.7); // limit bar height to 70% of chart
  };

  // Generate paths for cumulative charts
  let lineReceitasPath = '';
  let areaReceitasPath = '';
  let lineDespesasPath = '';
  let areaDespesasPath = '';
  let lineSaldoPath = '';
  let areaSaldoPath = '';

  if (points.length > 0) {
    points.forEach((p, idx) => {
      const x = getX(idx);
      
      // Receitas
      if (showReceitas) {
        const yReceitas = getY(p.acumuladoReceitas);
        if (idx === 0) {
          lineReceitasPath = `M ${x} ${yReceitas}`;
          areaReceitasPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${yReceitas}`;
        } else {
          lineReceitasPath += ` L ${x} ${yReceitas}`;
          areaReceitasPath += ` L ${x} ${yReceitas}`;
        }
        if (idx === points.length - 1) {
          areaReceitasPath += ` L ${x} ${paddingTop + chartHeight} Z`;
        }
      }

      // Despesas
      if (showDespesas) {
        const yDespesas = getY(p.acumuladoDespesas);
        if (idx === 0) {
          lineDespesasPath = `M ${x} ${yDespesas}`;
          areaDespesasPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${yDespesas}`;
        } else {
          lineDespesasPath += ` L ${x} ${yDespesas}`;
          areaDespesasPath += ` L ${x} ${yDespesas}`;
        }
        if (idx === points.length - 1) {
          areaDespesasPath += ` L ${x} ${paddingTop + chartHeight} Z`;
        }
      }

      // Saldo do Caixa Geral
      if (showSaldo) {
        const ySaldo = getY(p.acumulado);
        if (idx === 0) {
          lineSaldoPath = `M ${x} ${ySaldo}`;
          areaSaldoPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${ySaldo}`;
        } else {
          lineSaldoPath += ` L ${x} ${ySaldo}`;
          areaSaldoPath += ` L ${x} ${ySaldo}`;
        }
        if (idx === points.length - 1) {
          areaSaldoPath += ` L ${x} ${paddingTop + chartHeight} Z`;
        }
      }
    });
  }

  // Handle Mouse Hover/Move for Tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - paddingLeft;
    
    if (mouseX < 0 || mouseX > chartWidth) {
      setHoveredPoint(null);
      return;
    }

    const pct = mouseX / chartWidth;
    const index = Math.min(Math.max(Math.round(pct * (points.length - 1)), 0), points.length - 1);
    const point = points[index];

    if (point) {
      setHoveredPoint(point);
      setTooltipPos({
        x: getX(index) + rect.left - containerRef.current.getBoundingClientRect().left,
        y: getY(point.acumulado) - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Touch handlers for mobile pinch-to-zoom & tooltips
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoomLevel;
    } else if (e.touches.length === 1) {
      handleTouchMoveHover(e.touches[0], e.currentTarget);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      if (dist > 5) {
        const factor = dist / touchStartDistRef.current;
        const nextZoom = Math.min(4, Math.max(1, touchStartZoomRef.current * factor));
        setZoomLevel(Math.round(nextZoom * 10) / 10);
      }
    } else if (e.touches.length === 1) {
      handleTouchMoveHover(e.touches[0], e.currentTarget);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    setHoveredPoint(null);
  };

  const handleTouchMoveHover = (touch: React.Touch, svgElement: SVGSVGElement) => {
    if (!containerRef.current) return;
    const rect = svgElement.getBoundingClientRect();
    const touchX = touch.clientX - rect.left - paddingLeft;

    if (touchX < 0 || touchX > chartWidth) {
      setHoveredPoint(null);
      return;
    }

    const pct = touchX / chartWidth;
    const index = Math.min(Math.max(Math.round(pct * (points.length - 1)), 0), points.length - 1);
    const point = points[index];

    if (point) {
      setHoveredPoint(point);
      setTooltipPos({
        x: getX(index) + rect.left - containerRef.current.getBoundingClientRect().left,
        y: getY(point.acumulado) - 10
      });
    }
  };

  // Helper to format currency values nicely
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Generate grid values (Y-axis markers)
  const numGridLines = 4;
  const gridLines = Array.from({ length: numGridLines }).map((_, i) => {
    const val = minCum + (i * deltaCum) / (numGridLines - 1);
    return {
      value: val,
      y: getY(val)
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col h-full relative overflow-x-hidden w-full">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-slate-800 text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Fluxo de Caixa Geral
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full items-stretch">
          {/* Filtro de Período Customizado */}
          <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 w-full justify-between">
            <span className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider text-center block">Período</span>
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-1 shadow-xs w-full">
                <span className="text-[9px] text-slate-400 font-semibold select-none">De</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-slate-700 text-xs font-bold focus:outline-none w-full cursor-pointer p-0"
                  id="chart-start-date"
                />
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-1 shadow-xs w-full">
                <span className="text-[9px] text-slate-400 font-semibold select-none">Até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-slate-700 text-xs font-bold focus:outline-none w-full cursor-pointer p-0"
                  id="chart-end-date"
                />
              </div>
            </div>
          </div>

          {/* Include Caução Toggle */}
          <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 w-full justify-between">
            <span className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider text-center block">Cauções</span>
            <button
              onClick={() => setIncludeCaucao(!includeCaucao)}
              className={`flex items-center justify-center gap-1.5 p-1.5 rounded-md border transition-all cursor-pointer w-full text-xs font-bold shadow-xs h-[34px] ${
                includeCaucao 
                  ? 'bg-amber-50 text-amber-850 border-amber-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Contabilizar cauções líquidos no saldo geral"
            >
              {includeCaucao ? (
                <CheckSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span>Contabilizar</span>
            </button>
          </div>

          {/* Diário vs Semanal vs Mensal Switcher */}
          <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 w-full justify-between">
            <span className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider text-center block">Visualização</span>
            <div className="grid grid-cols-3 gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-xs w-full h-[34px]">
              <button
                onClick={() => setTimeFrame('diario')}
                className={`py-1 text-[10px] font-bold rounded transition-all cursor-pointer text-center ${
                  timeFrame === 'diario'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Diário
              </button>
              <button
                onClick={() => setTimeFrame('semanal')}
                className={`py-1 text-[10px] font-bold rounded transition-all cursor-pointer text-center ${
                  timeFrame === 'semanal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semanal
              </button>
              <button
                onClick={() => setTimeFrame('mensal')}
                className={`py-1 text-[10px] font-bold rounded transition-all cursor-pointer text-center ${
                  timeFrame === 'mensal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mensal
              </button>
            </div>
          </div>

          {/* Acumulado vs Periodo Switcher */}
          <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 w-full justify-between">
            <span className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider text-center block">Tipo de Gráfico</span>
            <div className="grid grid-cols-2 gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-xs w-full h-[34px]">
              <button
                onClick={() => setChartMode('acumulado')}
                className={`py-1 text-[10px] font-bold rounded transition-all cursor-pointer text-center ${
                  chartMode === 'acumulado'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Acumulado
              </button>
              <button
                onClick={() => setChartMode('diario')}
                className={`py-1 text-[10px] font-bold rounded transition-all cursor-pointer text-center ${
                  chartMode === 'diario'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {timeFrame === 'diario' ? 'Lançamentos' : timeFrame === 'semanal' ? 'Lançamentos' : 'Mensais'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative h-[260px] sm:h-[320px] select-none w-full overflow-hidden">
        {/* Y-Axis Fixed Labels Overlay - Sits absolutely at the left of the view, does not scroll! */}
        <div className="absolute left-0 top-0 bottom-0 w-[60px] bg-gradient-to-r from-white via-white/95 to-transparent pointer-events-none z-10 select-none pb-[40px]">
          {gridLines.map((line, idx) => (
            <div
              key={idx}
              className="absolute left-1 pr-2 w-full text-right font-mono text-[9px] font-extrabold text-slate-500/90 whitespace-nowrap"
              style={{ top: `${line.y - 6}px` }}
            >
              {formatCurrency(line.value).replace('R$', '').trim()}
            </div>
          ))}
        </div>

        {/* Dynamic HTML Tooltip - Fixed at Top-Right of the chart area */}
        {hoveredPoint && (
          <div
            className="absolute z-20 top-2 right-2 sm:right-4 bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2.5 shadow-xl border border-slate-800 text-[11px] text-left pointer-events-none min-w-[210px] animate-fade-in select-none"
          >
            <div className="flex items-center gap-1.5 text-slate-400 font-mono font-semibold pb-1 mb-1 border-b border-slate-800/80">
              <Calendar className="h-3 w-3" />
              {timeFrame === 'semanal' ? (
                `Semana de ${new Date(hoveredPoint.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}`
              ) : timeFrame === 'diario' ? (
                (() => {
                  const dObj = new Date(hoveredPoint.date + 'T00:00:00');
                  const formatted = dObj.toLocaleDateString('pt-BR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });
                  const isToday = hoveredPoint.date === getBrasiliaDateStr();
                  return `${formatted}${isToday ? ' (Hoje)' : ''}`;
                })()
              ) : (
                (() => {
                  const [year, month] = hoveredPoint.date.split('-');
                  const monthNamesFull = [
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                  ];
                  return `${monthNamesFull[Number(month) - 1]} / ${year}`;
                })()
              )}
            </div>

            <div className="space-y-0.5 font-sans">
              {chartMode === 'acumulado' ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3b42c4]"></span>
                      Caixa Geral:
                    </span>
                    <span className={`font-bold font-mono ${hoveredPoint.acumulado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(hoveredPoint.acumulado)}
                    </span>
                  </div>
                  {showReceitas && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400 flex items-center gap-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Receitas Acum.:
                      </span>
                      <span className="font-semibold font-mono text-emerald-400 font-normal">
                        {formatCurrency(hoveredPoint.acumuladoReceitas)}
                      </span>
                    </div>
                  )}
                  {showDespesas && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400 flex items-center gap-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Despesas Acum.:
                      </span>
                      <span className="font-semibold font-mono text-rose-300 font-normal">
                        {formatCurrency(hoveredPoint.acumuladoDespesas)}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-800 my-1 opacity-45"></div>
                  <div className="text-[9px] text-slate-400 font-medium italic pb-0.5">Movimentações do Período:</div>
                </>
              ) : null}

              <div className="flex justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Receitas:
                </span>
                <span className="font-medium font-mono text-emerald-400">
                  {formatCurrency(hoveredPoint.receitas)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Despesas:
                </span>
                <span className="font-medium font-mono text-rose-300">
                  {formatCurrency(hoveredPoint.despesas)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Caução Líquido:
                </span>
                <span className={`font-medium font-mono ${hoveredPoint.caucao >= 0 ? 'text-amber-300' : 'text-orange-400'}`}>
                  {formatCurrency(hoveredPoint.caucao)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="relative w-full h-full overflow-x-auto scrollbar-thin">
          {/* Render SVG content */}
          <svg
            width={totalWidth}
            height={dimensions.height}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="overflow-visible cursor-crosshair touch-none"
          >
          {/* Definitions for beautiful gradients */}
          <defs>
            <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b42c4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b42c4" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="receitasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="despesasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="barOrange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {gridLines.map((line, i) => (
            <g key={i} className="opacity-70">
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={totalWidth - paddingRight}
                y2={line.y}
                stroke="#f1f5f9"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            </g>
          ))}

          {/* X axis line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={totalWidth - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="#e2e8f0"
            strokeWidth={1}
          />

          {/* X-axis custom labels */}
          {points.length > 0 &&
            points.map((p, idx) => {
              // Only draw every N labels to prevent overlap
              const labelInterval = Math.ceil(points.length / 6);
              if (idx % labelInterval !== 0 && idx !== points.length - 1) return null;

              return (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={paddingTop + chartHeight + 18}
                  fill="#475569"
                  fontSize={10}
                  textAnchor="middle"
                  className="font-mono font-bold"
                >
                  {p.formattedDate}
                </text>
              );
            })}

          {chartMode === 'acumulado' ? (
            <>
              {/* 1. RECEITAS ACUMULADAS (GREEN) */}
              {showReceitas && (
                <>
                  {areaReceitasPath && (
                    <path
                      d={areaReceitasPath}
                      fill="url(#receitasGradient)"
                      className="transition-all duration-300"
                    />
                  )}
                  {lineReceitasPath && (
                    <path
                      d={lineReceitasPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300 pointer-events-none"
                    />
                  )}
                </>
              )}

              {/* 2. DESPESAS ACUMULADAS (RED) */}
              {showDespesas && (
                <>
                  {areaDespesasPath && (
                    <path
                      d={areaDespesasPath}
                      fill="url(#despesasGradient)"
                      className="transition-all duration-300"
                    />
                  )}
                  {lineDespesasPath && (
                    <path
                      d={lineDespesasPath}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300 pointer-events-none"
                    />
                  )}
                </>
              )}

              {/* 3. EVOLUÇÃO DO CAIXA GERAL (BLUE/INDIGO) */}
              {showSaldo && (
                <>
                  {areaSaldoPath && (
                    <path
                      d={areaSaldoPath}
                      fill="url(#saldoGradient)"
                      className="transition-all duration-300"
                    />
                  )}
                  {lineSaldoPath && (
                    <path
                      d={lineSaldoPath}
                      fill="none"
                      stroke="#3b42c4"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300 pointer-events-none"
                    />
                  )}
                </>
              )}

              {/* Data points markers (circles for active lines) */}
              {points.length <= 16 && points.map((p, idx) => {
                const cx = getX(idx);
                return (
                  <g key={idx} className="pointer-events-none select-none">
                    {/* Receitas dot */}
                    {showReceitas && (
                      <circle
                        cx={cx}
                        cy={getY(p.acumuladoReceitas)}
                        r={3}
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        className="transition-all duration-300 pointer-events-none"
                      />
                    )}
                    {/* Despesas dot */}
                    {showDespesas && (
                      <circle
                        cx={cx}
                        cy={getY(p.acumuladoDespesas)}
                        r={3}
                        fill="#ffffff"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        className="transition-all duration-300 pointer-events-none"
                      />
                    )}
                    {/* Saldo dot */}
                    {showSaldo && (
                      <circle
                        cx={cx}
                        cy={getY(p.acumulado)}
                        r={3.5}
                        fill="#ffffff"
                        stroke="#3b42c4"
                        strokeWidth={1.5}
                        className="transition-all duration-300 pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* Daily bars for revenues/expenses */}
              {points.map((p, idx) => {
                const x = getX(idx);
                const baselineY = paddingTop + chartHeight;
                const barWidth = Math.max(Math.min(chartWidth / points.length * 0.45, 12), 4);

                const hasReceitas = p.receitas > 0;
                const hasDespesas = p.despesas > 0;
                const hasCaucao = Math.abs(p.caucao) > 0;

                // Draw bars side by side, or stacked. Let's draw them beautifully!
                return (
                  <g key={idx} className="transition-all duration-300">
                    {/* Receitas Bar (Green) */}
                    {hasReceitas && showReceitas && (
                      <rect
                        x={x - barWidth - 1}
                        y={baselineY - getBarHeight(p.receitas)}
                        width={barWidth}
                        height={getBarHeight(p.receitas)}
                        fill="url(#barGreen)"
                        rx={1.5}
                      />
                    )}

                    {/* Despesas Bar (Red) */}
                    {hasDespesas && showDespesas && (
                      <rect
                        x={x + 1}
                        y={baselineY - getBarHeight(p.despesas)}
                        width={barWidth}
                        height={getBarHeight(p.despesas)}
                        fill="url(#barRed)"
                        rx={1.5}
                      />
                    )}

                    {/* Caução Bar (Orange) */}
                    {hasCaucao && p.caucao > 0 && includeCaucao && (
                      <rect
                        x={x - barWidth / 2}
                        y={baselineY - getBarHeight(p.caucao)}
                        width={barWidth}
                        height={getBarHeight(p.caucao)}
                        fill="url(#barOrange)"
                        opacity={0.8}
                        rx={1}
                      />
                    )}
                  </g>
                );
              })}
            </>
          )}

          {/* Active Hover vertical line and circles */}
          {hoveredPoint && (
            <g className="pointer-events-none">
              <line
                x1={getX(points.indexOf(hoveredPoint))}
                y1={paddingTop}
                x2={getX(points.indexOf(hoveredPoint))}
                y2={paddingTop + chartHeight}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              
              {/* Hover circles for each active curve */}
              {chartMode === 'acumulado' ? (
                <>
                  {showReceitas && (
                    <circle
                      cx={getX(points.indexOf(hoveredPoint))}
                      cy={getY(hoveredPoint.acumuladoReceitas)}
                      r={5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="shadow-premium"
                    />
                  )}
                  {showDespesas && (
                    <circle
                      cx={getX(points.indexOf(hoveredPoint))}
                      cy={getY(hoveredPoint.acumuladoDespesas)}
                      r={5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="shadow-premium"
                    />
                  )}
                  {showSaldo && (
                    <circle
                      cx={getX(points.indexOf(hoveredPoint))}
                      cy={getY(hoveredPoint.acumulado)}
                      r={6}
                      fill="#3b42c4"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="shadow-premium"
                    />
                  )}
                </>
              ) : (
                <circle
                  cx={getX(points.indexOf(hoveredPoint))}
                  cy={getY(hoveredPoint.acumulado)}
                  r={6}
                  fill="#3b42c4"
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="shadow-premium"
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </div>

      {/* Legend and Zoom Control Box below the chart */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 font-sans items-stretch">
        <button
          type="button"
          onClick={() => setShowReceitas(!showReceitas)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer shadow-xs h-[38px] text-left w-full ${
            showReceitas
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-white text-slate-400 border-slate-200 line-through opacity-60 hover:bg-slate-50'
          }`}
          title="Clique para ocultar/exibir receitas estimadas"
        >
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${showReceitas ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
          <div className="flex flex-col min-w-0">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">Receitas</span>
            <span className="text-[10px] font-bold truncate leading-tight mt-0.5">{chartMode === 'acumulado' ? 'Receitas Acumuladas' : 'Receitas'}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowDespesas(!showDespesas)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer shadow-xs h-[38px] text-left w-full ${
            showDespesas
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-white text-slate-400 border-slate-200 line-through opacity-60 hover:bg-slate-50'
          }`}
          title="Clique para ocultar/exibir despesas estimadas"
        >
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${showDespesas ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
          <div className="flex flex-col min-w-0">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">Despesas</span>
            <span className="text-[10px] font-bold truncate leading-tight mt-0.5">{chartMode === 'acumulado' ? 'Despesas Acumuladas' : 'Despesas'}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowSaldo(!showSaldo)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer shadow-xs h-[38px] text-left w-full ${
            showSaldo
              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
              : 'bg-white text-slate-400 border-slate-200 line-through opacity-60 hover:bg-slate-50'
          }`}
          title="Clique para ocultar/exibir a linha de evolução do caixa geral"
        >
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${showSaldo ? 'bg-[#3b42c4]' : 'bg-slate-300'}`}></span>
          <div className="flex flex-col min-w-0">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">Saldo Geral</span>
            <span className="text-[10px] font-bold truncate leading-tight mt-0.5">Evolução {includeCaucao ? '(Com Caução)' : '(Sem Caução)'}</span>
          </div>
        </button>

        {/* Zoom Controls at the bottom, matching the top styles */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-200 w-full h-[38px] shadow-xs">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider leading-none">Zoom</span>
            <span className="text-[10px] font-bold text-slate-700 leading-none mt-0.5">Linha do Tempo</span>
          </div>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-0.5 shadow-xs w-20 h-6">
            <button
              type="button"
              onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-0.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center h-full w-6"
              title="Reduzir Zoom (Mais compacto)"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-700 select-none">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.5))}
              disabled={zoomLevel >= 4}
              className="p-0.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center h-full w-6"
              title="Aumentar Zoom (Rolar para ver mais detalhes)"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
