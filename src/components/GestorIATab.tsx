import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Vehicle, 
  Rental, 
  Transaction, 
  FutureExpense, 
  InterestedLead, 
  AppUser 
} from '../types';
import { getBrasiliaDateStr, getBrasiliaUiDateStr } from '../utils/dateUtils';
import { isFinancingTransaction, isMaintenanceTransaction } from '../utils/transactions';
import { 
  Sparkles, 
  Send, 
  RotateCcw, 
  Bot, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  CarFront, 
  Coins, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  ExternalLink,
  Shield,
  Layers,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  Wrench,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  Eye,
  Trash2,
  Gauge,
  UploadCloud,
  Mic,
  Square,
  Download,
  Volume2,
  FileDown
} from 'lucide-react';

export interface GestorIATabProps {
  vehicles: Vehicle[];
  rentals: Rental[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  interestedLeads: InterestedLead[];
  users: AppUser[];
  currentUser: AppUser | null;
  financials: {
    currentCash: number;
    totalRevenues: number;
    totalExpenses: number;
    activeCaucaoInHand: number;
    financingExpenses?: number;
    maintenanceExpenses?: number;
    otherExpenses?: number;
  };
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpdateVehicleStatus: (id: string, status: 'available' | 'rented' | 'maintenance') => void;
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle?: (id: string, updatedFields: Partial<Vehicle>) => void;
  onAddFutureExpense: (fe: Omit<FutureExpense, 'id'>) => void;
  onStartRental: (r: Omit<Rental, 'id'>) => void;
  onTerminateRental: (rentalId: string, endDate: string) => void;
  onAddInterestedLead: (lead: Omit<InterestedLead, 'id' | 'createdAt'>) => void;
  onNavigateTab: (tab: 'dashboard' | 'financials' | 'transactions' | 'vehicles' | 'rentals' | 'users') => void;
  showNotification: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export interface AttachedFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  base64: string;
  isImage: boolean;
  isAudio?: boolean;
}

export interface GeneratedReportPayload {
  title: string;
  filename: string;
  format: 'pdf' | 'csv' | 'txt' | 'json';
  summary: string;
  headers?: string[];
  rows?: string[][];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  attachments?: Array<{
    name: string;
    type: string;
    dataUrl: string;
    isImage: boolean;
    isAudio?: boolean;
    size: number;
  }>;
  generatedReports?: GeneratedReportPayload[];
  actionsExecuted?: Array<{
    type: string;
    description: string;
    targetTab?: 'dashboard' | 'financials' | 'transactions' | 'vehicles' | 'rentals' | 'users';
  }>;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'model',
  text: 'Skywalker ao seu comando! Pronto para trabalhar!',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
};

const QUICK_PROMPTS = [
  { label: '💰 Saldo & Receita', prompt: 'Qual o saldo atual em caixa e o total de receitas acumuladas?' },
  { label: '📄 Emitir Relatório PDF', prompt: 'Emita um relatório executivo completo em PDF com o resumo financeiro, veículos e contratos ativos para download.' },
  { label: '🚗 Veículos Livres & Oficina', prompt: 'Quais veículos estão disponíveis para locação e quais estão na oficina?' },
  { label: '📅 Despesas Próximos 30 dias', prompt: 'Quais são as despesas futuras previstas para os próximos 30 dias?' },
  { label: '📊 Carro Mais Lucrativo', prompt: 'Qual veículo gerou maior receita em aluguéis e qual teve mais gastos de manutenção?' },
  { label: '👥 Contratos Ativos', prompt: 'Quantos contratos estão ativos atualmente e qual o valor semanal de cada um?' }
];

export const GestorIATab: React.FC<GestorIATabProps> = ({
  vehicles,
  rentals,
  transactions,
  futureExpenses,
  interestedLeads,
  users,
  currentUser,
  financials,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateVehicleStatus,
  onAddVehicle,
  onUpdateVehicle,
  onAddFutureExpense,
  onStartRental,
  onTerminateRental,
  onAddInterestedLead,
  onNavigateTab,
  showNotification
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('loca_skywalker_chat');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [INITIAL_MESSAGE];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const autoSendAudioRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Start Microphone Audio Recording
  const startAudioRecording = async () => {
    if (isLoading || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsRecording(false);
        setRecordingSeconds(0);

        if (audioChunksRef.current.length === 0) return;

        const actualMime = (recorder.mimeType || 'audio/webm').split(';')[0];
        const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const cleanBase64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
          const newAudioItem: AttachedFileItem = {
            id: 'att_aud_' + Date.now(),
            name: `comando_voz_${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-')}.${ext}`,
            type: actualMime,
            size: audioBlob.size,
            dataUrl,
            base64: cleanBase64,
            isImage: false,
            isAudio: true
          };

          if (autoSendAudioRef.current) {
            autoSendAudioRef.current = false;
            sendDirectAudioMessage(newAudioItem);
          } else {
            setAttachments(prev => [...prev, newAudioItem]);
            showNotification('Áudio gravado e anexado! Pressione Enviar ou adicione instruções.', 'success');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      showNotification('Não foi possível acessar o microfone. Verifique as permissões do navegador.', 'error');
    }
  };

  const stopAudioRecording = (sendImmediately: boolean = false) => {
    autoSendAudioRef.current = sendImmediately;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelAudioRecording = () => {
    autoSendAudioRef.current = false;
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    showNotification('Gravação de áudio cancelada.', 'info');
  };

  // File attachments handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const processFiles = (filesList: File[]) => {
    const validFiles = filesList.filter(f => f.size <= 25 * 1024 * 1024);
    if (validFiles.length < filesList.length) {
      showNotification('Alguns arquivos excederam o limite máximo de 25MB e foram desconsiderados.', 'info');
    }

    validFiles.forEach(file => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const isAud = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name);
      reader.onload = () => {
        const result = reader.result as string;
        const cleanBase64 = result.includes('base64,') ? result.split('base64,')[1] : result;
        setAttachments(prev => [
          ...prev,
          {
            id: 'att_' + Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type || (file.name.endsWith('.csv') ? 'text/csv' : isAud ? 'audio/webm' : 'application/octet-stream'),
            size: file.size,
            dataUrl: result,
            base64: cleanBase64,
            isImage: isImg,
            isAudio: isAud
          }
        ]);
        showNotification(`Arquivo "${file.name}" anexado para análise do Skywalker.`, 'info');
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Helper to extract markdown tables from raw text when exporting any message
  const extractMarkdownTableFromText = (rawText: string): { headers: string[]; rows: string[][] } | null => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    if (lines.length < 2) return null;
    const parseRow = (line: string) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim().replace(/\*\*/g, ''));

    const headers = parseRow(lines[0]);
    const dataLines = lines.slice(1).filter(l => !/^\|[\s\-:|]+\|$/.test(l));
    const rows = dataLines.map(parseRow);
    return headers.length > 0 && rows.length > 0 ? { headers, rows } : null;
  };

  // Universal Report & File Downloader (PDF, CSV, TXT, JSON)
  const triggerReportDownload = (report: GeneratedReportPayload, targetFormat?: 'pdf' | 'csv' | 'txt' | 'json') => {
    const fmt = (targetFormat || report.format || 'pdf').toLowerCase() as 'pdf' | 'csv' | 'txt' | 'json';
    const baseName = (report.filename || report.title || 'relatorio_eletroflow')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'relatorio_eletroflow';

    const cleanSummary = (report.summary || '').replace(/\*\*/g, '');
    const headers = report.headers && report.headers.length > 0 ? report.headers : [];
    const rows = report.rows && report.rows.length > 0 ? report.rows : [];

    try {
      if (fmt === 'pdf') {
        const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Corporate Header Banner
        doc.setFillColor(15, 23, 42); // Slate-900
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setFillColor(6, 182, 212); // Cyan-500 accent bar
        doc.rect(0, 28, pageWidth, 1.5, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('ELETROFLOW - SKYWALKER GESTOR IA', 14, 12);

        doc.setFontSize(10);
        doc.setTextColor(103, 232, 249); // Cyan-300
        doc.text(report.title || 'Relatório Executivo', 14, 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(203, 213, 225);
        doc.text(`Emitido em: ${getBrasiliaUiDateStr()}`, pageWidth - 14, 12, { align: 'right' });
        doc.text(`Caixa Atual: R$ ${financials.currentCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 14, 20, { align: 'right' });

        let currentY = 38;

        // Executive Summary Section
        if (cleanSummary) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text('Resumo Executivo / Parecer Skywalker:', 14, currentY);
          currentY += 6;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          const splitLines = doc.splitTextToSize(cleanSummary, pageWidth - 28);
          doc.text(splitLines, 14, currentY);
          currentY += splitLines.length * 4.5 + 6;
        }

        // Table Data if available
        if (headers.length > 0 && rows.length > 0) {
          autoTable(doc, {
            startY: Math.min(currentY, 240),
            head: [headers],
            body: rows,
            theme: 'grid',
            styles: {
              fontSize: 8.5,
              cellPadding: 2.8,
              textColor: [30, 41, 59]
            },
            headStyles: {
              fillColor: [15, 23, 42],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didParseCell: (data) => {
              if (data.section === 'body') {
                const cellText = String(data.cell.raw || '');
                // Keep plates neutral, color negative money red and positive money green
                const isPlate = /\b([A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}-?[0-9]{4})\b/i.test(cellText);
                if (!isPlate) {
                  if (cellText.includes('-R$') || cellText.startsWith('-')) {
                    data.cell.styles.textColor = [225, 29, 72]; // Rose-600
                    data.cell.styles.fontStyle = 'bold';
                  } else if (cellText.includes('+R$') || cellText.startsWith('+')) {
                    data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
                    data.cell.styles.fontStyle = 'bold';
                  }
                }
              }
            }
          });
        }

        doc.save(`${baseName}.pdf`);
        showNotification(`Relatório PDF "${baseName}.pdf" baixado com sucesso!`, 'success');
      } else if (fmt === 'csv') {
        const csvLines: string[] = [];
        if (headers.length > 0) {
          csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';'));
          rows.forEach(r => {
            csvLines.push(r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
          });
        } else {
          csvLines.push(`"Relatório";"${report.title}"`);
          csvLines.push(`"Data";"${getBrasiliaUiDateStr()}"`);
          csvLines.push(`"Resumo";"${cleanSummary.replace(/"/g, '""')}"`);
        }
        const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Planilha CSV "${baseName}.csv" baixada com sucesso!`, 'success');
      } else if (fmt === 'json') {
        const payload = {
          titulo: report.title,
          emitidoEm: getBrasiliaUiDateStr(),
          resumo: cleanSummary,
          colunas: headers,
          dados: rows
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Arquivo JSON "${baseName}.json" baixado com sucesso!`, 'success');
      } else {
        // TXT
        let txtContent = `==========================================================\n`;
        txtContent += `ELETROFLOW - SKYWALKER GESTOR IA\n`;
        txtContent += `RELATÓRIO: ${report.title}\n`;
        txtContent += `DATA DE EMISSÃO: ${getBrasiliaUiDateStr()}\n`;
        txtContent += `==========================================================\n\n`;
        if (cleanSummary) {
          txtContent += `${cleanSummary}\n\n`;
        }
        if (headers.length > 0 && rows.length > 0) {
          txtContent += headers.join(' | ') + '\n';
          txtContent += '-'.repeat(60) + '\n';
          rows.forEach(r => {
            txtContent += r.join(' | ') + '\n';
          });
        }
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Relatório TXT "${baseName}.txt" baixado com sucesso!`, 'success');
      }
    } catch (err) {
      console.error('Erro ao gerar arquivo para download:', err);
      showNotification('Erro ao gerar o arquivo para download.', 'error');
    }
  };

  // Export any chat message directly to PDF, CSV, or TXT
  const exportChatMessageAsFile = (msg: ChatMessage, format: 'pdf' | 'csv' | 'txt') => {
    const parsedTable = extractMarkdownTableFromText(msg.text);
    const nonTableLines = msg.text
      .split('\n')
      .filter(l => !l.trim().startsWith('|'))
      .join('\n')
      .trim();

    triggerReportDownload(
      {
        title: 'Relatório Executivo Skywalker - Eletroflow',
        filename: `relatorio_skywalker_${getBrasiliaDateStr()}`,
        format,
        summary: nonTableLines || msg.text,
        headers: parsedTable?.headers || [],
        rows: parsedTable?.rows || []
      },
      format
    );
  };

  // Dynamic Mouse & Touch Drag Resizing
  const [chatHeight, setChatHeight] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('loca_skywalker_chat_height');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 380 && val <= 2400) return val;
      }
    } catch (_) {}
    return 680;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(680);

  const startResizing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) return;
    if ('button' in e && e.button !== 0) return; // only left click
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = chatHeight;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = currentY - startYRef.current;
      const newHeight = Math.max(380, Math.min(2400, startHeightRef.current + deltaY));
      setChatHeight(newHeight);
      try {
        localStorage.setItem('loca_skywalker_chat_height', String(newHeight));
      } catch (_) {}
    };

    const onEnd = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Auto-save chat history locally
  useEffect(() => {
    try {
      localStorage.setItem('loca_skywalker_chat', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    localStorage.removeItem('loca_skywalker_chat');
    showNotification('Histórico da conversa reiniciado.', 'info');
  };

  // Helper to execute function calls returned by Gemini
  const executeFunctionCalls = (functionCalls: Array<{ name: string; args: any }>) => {
    const executed: Array<{ type: string; description: string; targetTab?: any }> = [];
    const generatedReportsList: GeneratedReportPayload[] = [];
    const today = getBrasiliaDateStr();

    for (const call of functionCalls) {
      const { name, args } = call;
      try {
        if (name === 'add_transaction') {
          const type = args.type || 'despesa';
          const value = Number(args.value) || 0;
          const category = args.category || 'Geral';
          const description = args.description || 'Lançamento via Skywalker';
          const date = args.date || today;
          
          let matchedVehicleId: string | undefined = undefined;
          if (args.vehiclePlateOrId) {
            const vMatch = vehicles.find(v => 
              v.id === args.vehiclePlateOrId || 
              v.plate.toUpperCase().replace('-', '') === String(args.vehiclePlateOrId).toUpperCase().replace('-', '')
            );
            if (vMatch) matchedVehicleId = vMatch.id;
          }

          onAddTransaction({
            type,
            value,
            category,
            description,
            date,
            vehicleId: matchedVehicleId
          });

          executed.push({
            type: 'Transação Lançada',
            description: `${type.toUpperCase()}: R$ ${value.toFixed(2)} - ${description}`,
            targetTab: 'transactions'
          });
        } 
        else if (name === 'update_vehicle_status') {
          const plateOrId = String(args.plateOrId || '');
          const newStatus = args.newStatus;
          const v = vehicles.find(item => 
            item.id === plateOrId || 
            item.plate.toUpperCase().replace('-', '') === plateOrId.toUpperCase().replace('-', '')
          );
          if (v && (newStatus === 'available' || newStatus === 'rented' || newStatus === 'maintenance')) {
            onUpdateVehicleStatus(v.id, newStatus);
            executed.push({
              type: 'Status de Veículo Atualizado',
              description: `${v.brandModel} (${v.plate}) → ${newStatus === 'available' ? 'Disponível' : newStatus === 'rented' ? 'Locado' : 'Oficina'}`,
              targetTab: 'vehicles'
            });
          }
        }
        else if (name === 'add_vehicle') {
          onAddVehicle({
            brandModel: args.brandModel || 'Veículo',
            plate: args.plate || 'SEM-PLACA',
            weeklyRate: Number(args.weeklyRate) || 600,
            depositValue: Number(args.depositValue) || 1500,
            status: args.status || 'available',
            mileage: args.mileage ? Number(args.mileage) : undefined
          });
          executed.push({
            type: 'Veículo Cadastrado',
            description: `${args.brandModel} (${args.plate})`,
            targetTab: 'vehicles'
          });
        }
        else if (name === 'add_future_expense') {
          const value = Number(args.value) || 0;
          const count = Number(args.installmentsCount) || 1;
          const installments = [];
          for (let i = 1; i <= count; i++) {
            installments.push({
              id: 'inst_' + Math.random().toString(36).substr(2, 9),
              installmentNumber: i,
              dueDate: args.startDate || today,
              status: 'pending' as const
            });
          }
          onAddFutureExpense({
            description: args.description || 'Previsão de Despesa',
            category: args.category || 'Despesa Fixa',
            value,
            installmentsCount: count,
            startDate: args.startDate || today,
            dueDay: Number(args.dueDay) || 10,
            installments
          });
          executed.push({
            type: 'Despesa Futura Programada',
            description: `${args.description} (${count}x de R$ ${value.toFixed(2)})`,
            targetTab: 'financials'
          });
        }
        else if (name === 'start_rental') {
          const v = vehicles.find(item => 
            item.id === args.vehiclePlateOrId || 
            item.plate.toUpperCase().replace('-', '') === String(args.vehiclePlateOrId).toUpperCase().replace('-', '')
          );
          if (v) {
            onStartRental({
              vehicleId: v.id,
              tenantName: args.tenantName,
              phone: args.phone || '',
              startDate: args.startDate || today,
              endDate: '2026-12-31',
              weeklyRate: Number(args.weeklyRate) || v.weeklyRate,
              depositValue: Number(args.depositValue) || v.depositValue,
              status: 'active',
              paymentDayOfWeek: args.paymentDayOfWeek !== undefined ? Number(args.paymentDayOfWeek) : 1
            });
            executed.push({
              type: 'Contrato de Locação Iniciado',
              description: `${v.brandModel} (${v.plate}) para ${args.tenantName}`,
              targetTab: 'rentals'
            });
          }
        }
        else if (name === 'terminate_rental') {
          const target = rentals.find(r => 
            r.id === args.contractIdOrPlate || 
            r.vehicleId === args.contractIdOrPlate
          );
          if (target) {
            onTerminateRental(target.id, args.endDate || today);
            executed.push({
              type: 'Contrato Encerrado',
              description: `Locação de ${target.tenantName} finalizada`,
              targetTab: 'rentals'
            });
          }
        }
        else if (name === 'add_interested_lead') {
          onAddInterestedLead({
            name: args.name,
            phone: args.phone,
            notes: args.notes || 'Interessado adicionado via Skywalker IA',
            contactDate: today,
            docApproved: false,
            contactCount: 1
          });
          executed.push({
            type: 'Interessado Cadastrado',
            description: `${args.name} (${args.phone})`,
            targetTab: 'rentals'
          });
        }
        else if (name === 'update_vehicle_mileage') {
          const plateOrId = String(args.plateOrId || '');
          const newMileage = Number(args.mileage) || 0;
          const notes = args.notes || 'Aferição de odômetro via Skywalker IA';
          const target = vehicles.find(v => 
            v.id === plateOrId || 
            v.plate.toUpperCase().replace('-', '') === plateOrId.toUpperCase().replace('-', '')
          );
          if (target && onUpdateVehicle) {
            const todayStr = getBrasiliaDateStr();
            const currentMonth = todayStr.substring(0, 7);
            onUpdateVehicle(target.id, {
              mileage: newMileage,
              mileageDate: todayStr,
              monthlyMileages: {
                ...(target.monthlyMileages || {}),
                [currentMonth]: newMileage
              },
              monthlyNotes: {
                ...(target.monthlyNotes || {}),
                [currentMonth]: notes
              }
            });
            executed.push({
              type: 'Odômetro Aferido',
              description: `${target.brandModel} (${target.plate}): ${newMileage.toLocaleString('pt-BR')} km registrado`,
              targetTab: 'vehicles'
            });
          }
        }
        else if (name === 'delete_transaction') {
          const targetId = String(args.transactionId || '');
          const descFilter = args.description ? String(args.description).toLowerCase() : '';
          const tx = transactions.find(t => 
            t.id === targetId || 
            (descFilter && t.description.toLowerCase().includes(descFilter))
          );
          if (tx && onDeleteTransaction) {
            onDeleteTransaction(tx.id);
            executed.push({
              type: 'Lançamento Removido',
              description: `${tx.description} (${tx.type.toUpperCase()}: R$ ${tx.value.toFixed(2)})`,
              targetTab: 'transactions'
            });
          }
        }
        else if (name === 'get_vehicle_maintenance_history') {
          const v = vehicles.find(item => 
            item.id === args.plateOrId || 
            item.plate.toUpperCase().replace('-', '') === String(args.plateOrId).toUpperCase().replace('-', '')
          );
          if (v) {
            const repairs = transactions.filter(t => 
              (t.vehicleId === v.id || (t.description && t.description.includes(v.plate))) &&
              t.type === 'despesa' &&
              (t.category === 'Manutenção' || t.category.includes('Manutenção') || t.category === 'Revisão' || t.category === 'Pneus' || t.category === 'Oficina')
            );
            const totalRepairs = repairs.reduce((sum, r) => sum + r.value, 0);
            onNavigateTab('vehicles');
            executed.push({
              type: 'Histórico de Manutenção Consultado',
              description: `${v.brandModel} (${v.plate}): ${repairs.length} intervenção(ões), Total: R$ ${totalRepairs.toFixed(2)}`,
              targetTab: 'vehicles'
            });
          }
        }
        else if (name === 'get_financial_breakdown') {
          onNavigateTab('financials');
          executed.push({
            type: 'Demonstrativo Financeiro Consultado',
            description: `Apresentando separação entre Financiamentos e Manutenções`,
            targetTab: 'financials'
          });
        }
        else if (name === 'navigate_to_tab') {
          if (args.tab) {
            onNavigateTab(args.tab);
            executed.push({
              type: 'Navegação',
              description: `Navegou para a aba ${args.tab}`,
              targetTab: args.tab
            });
          }
        }
        else if (name === 'generate_downloadable_report') {
          const reportPayload: GeneratedReportPayload = {
            title: args.title || 'Relatório Executivo Eletroflow',
            filename: args.filename || 'relatorio_eletroflow',
            format: (args.format || 'pdf').toLowerCase() as 'pdf' | 'csv' | 'txt' | 'json',
            summary: args.summary || '',
            headers: Array.isArray(args.headers) ? args.headers.map(String) : [],
            rows: Array.isArray(args.rows) ? args.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : [])) : []
          };
          generatedReportsList.push(reportPayload);
          triggerReportDownload(reportPayload);
          executed.push({
            type: `Relatório ${reportPayload.format.toUpperCase()} Emitido`,
            description: `${reportPayload.title} (${reportPayload.format.toUpperCase()}) gerado para download`
          });
        }
      } catch (err) {
        console.warn("[Skywalker Action Execution Error]:", err);
      }
    }

    return { executed, generatedReportsList };
  };

  const sendDirectAudioMessage = (audioFile: AttachedFileItem) => {
    handleSendMessage(inputMessage, [audioFile]);
  };

  const handleSendMessage = async (textToSend?: string, customAttachments?: AttachedFileItem[]) => {
    const query = (textToSend !== undefined ? textToSend : inputMessage).trim();
    const activeAttachments = customAttachments || attachments;
    const hasAttachments = activeAttachments.length > 0;
    if ((!query && !hasAttachments) || isLoading) return;

    const attachedSnapshot = activeAttachments.map(a => ({
      name: a.name,
      type: a.type,
      dataUrl: a.dataUrl,
      isImage: a.isImage,
      isAudio: a.isAudio,
      size: a.size
    }));

    const attachmentsForApi = activeAttachments.map(a => ({
      name: a.name,
      mimeType: a.type,
      data: a.base64
    }));

    const hasAudioOnly = !query && activeAttachments.length === 1 && activeAttachments[0].isAudio;
    const displayText = query || (hasAudioOnly
      ? '🎙️ Mensagem de voz enviada para o Skywalker'
      : activeAttachments.length === 1
      ? `[Arquivo anexado: ${activeAttachments[0].name}]`
      : `[${activeAttachments.length} arquivos anexados para análise]`);

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: displayText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      attachments: attachedSnapshot.length > 0 ? attachedSnapshot : undefined
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    if (!customAttachments) {
      setAttachments([]);
    }
    setIsLoading(true);

    try {
      // Build snapshot context with all accessible data
      const totalFinancing = transactions
        .filter(t => isFinancingTransaction(t))
        .reduce((sum, t) => sum + t.value, 0);

      const totalMaintenanceAll = transactions
        .filter(t => isMaintenanceTransaction(t))
        .reduce((sum, t) => sum + t.value, 0);

      const contextSnapshot = {
        hoje: getBrasiliaDateStr(),
        financeiro: {
          dinheiroEmCaixa: financials.currentCash,
          receitasTotais: financials.totalRevenues,
          despesasTotais: financials.totalExpenses,
          caucaoEmMaos: financials.activeCaucaoInHand,
          despesasFinanciamentoTotal: totalFinancing,
          despesasManutencaoTotal: totalMaintenanceAll,
          outrasDespesasOperacionais: Math.max(0, financials.totalExpenses - totalFinancing - totalMaintenanceAll)
        },
        separacaoFinanceira: {
          despesasFinanciamentoTotal: totalFinancing,
          despesasManutencaoTotal: totalMaintenanceAll,
          outrasDespesasOperacionais: Math.max(0, financials.totalExpenses - totalFinancing - totalMaintenanceAll),
          financiamentosFuturos: futureExpenses.filter(fe => fe.category === 'Financiamento').map(fe => ({
            descricao: fe.description,
            valorParcela: fe.value,
            totalParcelas: fe.installmentsCount,
            parcelasPendentes: fe.installments.filter(i => i.status === 'pending').length
          }))
        },
        frota: vehicles.filter(v => !v.isDeleted).map(v => {
          const currentRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
          const vehicleMaintenanceTxs = transactions.filter(t => 
            (t.vehicleId === v.id || (t.description && t.description.includes(v.plate))) &&
            isMaintenanceTransaction(t)
          );
          const totalMaintenance = vehicleMaintenanceTxs.reduce((sum, t) => sum + t.value, 0);
          return {
            id: v.id,
            placa: v.plate,
            modelo: v.brandModel,
            status: v.status,
            valorSemanal: v.weeklyRate,
            caucao: v.depositValue,
            kmAtual: v.mileage,
            dataKm: v.mileageDate,
            afericoesMensais: v.monthlyMileages || {},
            notasMensais: v.monthlyNotes || {},
            historicoKm: v.mileageHistory || [],
            locatarioAtual: currentRental ? currentRental.tenantName : null,
            totalGastoManutencao: totalMaintenance,
            quantidadeManutencoes: vehicleMaintenanceTxs.length,
            historicoManutencoes: vehicleMaintenanceTxs.map(mt => ({
              data: mt.date,
              descricao: mt.description,
              valor: mt.value,
              categoria: mt.category
            }))
          };
        }),
        contratos: rentals.filter(r => !r.isDeleted).map(r => {
          const v = vehicles.find(veh => veh.id === r.vehicleId);
          return {
            id: r.id,
            veiculoPlaca: v ? v.plate : 'N/A',
            veiculoModelo: v ? v.brandModel : 'N/A',
            locatario: r.tenantName,
            telefone: r.phone,
            inicio: r.startDate,
            fim: r.endDate,
            valorSemanal: r.weeklyRate,
            caucao: r.depositValue,
            status: r.status,
            diaPagamentoSemana: r.paymentDayOfWeek
          };
        }),
        extratoRecente: transactions.slice(-140).map(t => {
          const v = t.vehicleId ? vehicles.find(veh => veh.id === t.vehicleId) : null;
          return {
            id: t.id,
            data: t.date,
            tipo: t.type,
            valor: t.value,
            categoria: t.category,
            descricao: t.description,
            placa: v ? v.plate : null
          };
        }),
        despesasFuturas: futureExpenses.map(fe => ({
          id: fe.id,
          descricao: fe.description,
          categoria: fe.category,
          valorParcela: fe.value,
          totalParcelas: fe.installmentsCount,
          diaVencimento: fe.dueDay,
          parcelasPendentes: fe.installments.filter(i => i.status === 'pending').map(i => i.dueDate)
        })),
        interessadosNaFila: interestedLeads.map(l => ({
          id: l.id,
          nome: l.name,
          telefone: l.phone,
          documentoAprovado: l.docApproved,
          observacoes: l.notes
        })),
        usuarioConectado: currentUser ? {
          nome: currentUser.name,
          email: currentUser.email,
          papel: currentUser.role
        } : null
      };

      const defaultPromptForMedia = activeAttachments.some(a => a.isAudio)
        ? "Ouça atentamente esta mensagem de áudio do usuário e execute ou responda exatamente o que foi solicitado."
        : "Por favor, analise minuciosamente os arquivos/documentos anexados e processe as informações no sistema.";

      const res = await fetch('/api/gestor-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query || defaultPromptForMedia,
          history: messages.slice(-8).map(m => ({ role: m.role, text: m.text })),
          context: contextSnapshot,
          attachments: attachmentsForApi
        })
      });

      if (!res.ok) {
        let serverErrorText = '';
        try {
          const errData = await res.json();
          serverErrorText = errData.error || errData.details || '';
        } catch (_) {}
        if (serverErrorText.includes('models/') || serverErrorText.includes('404') || serverErrorText.includes('503') || serverErrorText.includes('high demand') || serverErrorText.startsWith('{')) {
          serverErrorText = 'Os servidores de inteligência artificial estão com alta demanda temporária no momento. Por favor, aguarde alguns segundos e tente novamente.';
        }
        throw new Error(serverErrorText || `Erro HTTP ${res.status} ao comunicar com o servidor.`);
      }

      const data = await res.json();
      
      let actionsExecuted: Array<{ type: string; description: string; targetTab?: any }> = [];
      let generatedReports: GeneratedReportPayload[] = [];
      if (data.functionCalls && data.functionCalls.length > 0) {
        const result = executeFunctionCalls(data.functionCalls);
        actionsExecuted = result.executed;
        generatedReports = result.generatedReportsList;
        if (actionsExecuted.length > 0) {
          showNotification(`✓ ${actionsExecuted.length} ação(ões) executada(s) pelo Skywalker.`, 'success');
        }
      }

      let replyText = data.reply || 'Operação processada.';
      if (replyText.startsWith('{') && replyText.includes('"error"')) {
        replyText = 'Os servidores de inteligência artificial estão com alta demanda temporária. Por favor, aguarde alguns instantes e tente novamente.';
      }

      const modelMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        generatedReports: generatedReports.length > 0 ? generatedReports : undefined,
        actionsExecuted: actionsExecuted.length > 0 ? actionsExecuted : undefined
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error("Skywalker chat error:", err);
      let displayMsg = err?.message || 'Não consegui me comunicar com o servidor no momento. Por favor, verifique sua conexão ou tente novamente em instantes.';
      if (displayMsg.startsWith('{') && displayMsg.includes('"error"')) {
        displayMsg = 'Os servidores de inteligência artificial estão com alta demanda temporária. Por favor, tente novamente em alguns segundos.';
      }
      const errorMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: displayMsg,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      showNotification(displayMsg, 'error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Financial numbers & markdown formatting: Green for positive/revenues, Red for negative/expenses
  // CRITICAL: Vehicle plates (ex: TYU-0E16, ABC-1234) are strictly protected so they are NEVER colored red as negative numbers!
  const highlightFormatting = (str: string, contextHint: string = '') => {
    if (!str) return '';

    // Step 1: Detect and protect Brazilian license plates FIRST
    // Matches Mercosul (ex: TYU-0E16, TYU 0E16, TYU0E16, BRA2E19) and Legacy (ex: ABC-1234, ABC 1234)
    const plateTokens: { [key: string]: string } = {};
    let plateCounter = 0;

    const plateRegex = /\b([a-zA-Z]{3}\s*[-–—]?\s*[0-9][a-zA-Z0-9][0-9]{2}|[a-zA-Z]{3}\s*[-–—]?\s*[0-9]{4})\b/g;

    let preprocessed = str.replace(plateRegex, (match) => {
      // Normalize plate display to standard hyphenated uppercase: ABC-1234 or TYU-0E16
      const cleanUpper = match.toUpperCase().replace(/\s+/g, '');
      let normalizedPlate = cleanUpper;
      if (!cleanUpper.includes('-') && cleanUpper.length === 7) {
        normalizedPlate = `${cleanUpper.substring(0, 3)}-${cleanUpper.substring(3)}`;
      }
      const token = `___VEHICLE_PLATE_TOKEN_${plateCounter++}___`;
      plateTokens[token] = `<span class="inline-flex items-center gap-1 font-mono font-bold tracking-wider text-cyan-300 bg-slate-900/90 px-1.5 py-0.5 rounded border border-cyan-500/40 shadow-xs uppercase not-italic text-[11px] whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span>${normalizedPlate}</span>`;
      return token;
    });

    // Step 2: Bold **text**
    let formatted = preprocessed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

    // Step 3: Financial contextual tags & Monetary amounts
    const expenseRegex = /(despesa|despesas|gasto|gastos|oficina|manutenç|parcela|parcelas|financiamento|financiamentos|saída|saida|saídas|saidas|prejuízo|prejuizo|déficit|deficit|dívida|divida|custo|custos|débito|debito|pneu|pneus|seguro|ipva|revis|reparo|reparos|conserto|consertos|pendente|pagar|pago|pagamento)/i;
    const revenueRegex = /(receita|receitas|entrada|entradas|aluguel|aluguéis|alugueis|locaç|lucro|lucros|superávit|superavit|faturamento|ganho|ganhos|saldo\s+positivo|receber|recebido)/i;

    const combinedContext = (str + ' ' + contextHint).toLowerCase();
    const isContextExpense = expenseRegex.test(combinedContext);
    const isContextRevenue = revenueRegex.test(combinedContext);

    // Strictly match currency amounts with boundaries:
    // With explicit R$: [+-]? R$ [+-]? 1.200,00 | (R$ 500,00)
    // Or standalone signed numbers with word boundaries: +1.200,00 | -790,00 | 1.200 reais
    const moneyRegex = /([+\-−]?\s*R\$\s*[+\-−]?\s*[\d.,]+|\(\s*R\$\s*[\d.,]+\s*\)|(?<=^|[\s(])[+\-−]\s*[\d.,]+(?:\s*reais)?(?=$|[\s),.;:!])|(?<=^|[\s(])[\d.,]+\s*reais(?=$|[\s),.;:!]))/gi;

    formatted = formatted.replace(moneyRegex, (match) => {
      const isExplicitNegative = match.includes('-') || match.includes('−') || (match.startsWith('(') && match.endsWith(')'));
      const isExplicitPositive = match.includes('+');

      if (isExplicitNegative || (!isExplicitPositive && isContextExpense && !isContextRevenue)) {
        return `<span class="inline-flex items-center font-mono font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40 whitespace-nowrap shadow-xs">${match}</span>`;
      } else {
        return `<span class="inline-flex items-center font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/40 whitespace-nowrap shadow-xs">${match}</span>`;
      }
    });

    // Step 4: Restore protected vehicle plate tokens
    Object.keys(plateTokens).forEach((token) => {
      formatted = formatted.replace(new RegExp(token, 'g'), plateTokens[token]);
    });

    return formatted;
  };

  // Render markdown-like formatting with full block support (tables, lists, paragraphs, currency badges)
  const renderFormattedText = (rawText: string) => {
    if (!rawText) return null;

    // Parse blocks: separates markdown tables from regular text/list blocks
    const lines = rawText.split('\n');
    interface ContentBlock {
      type: 'table' | 'text';
      lines: string[];
    }
    const blocks: ContentBlock[] = [];
    let currentTable: string[] = [];
    let currentText: string[] = [];

    const flushText = () => {
      if (currentText.length > 0) {
        blocks.push({ type: 'text', lines: [...currentText] });
        currentText = [];
      }
    };

    const flushTable = () => {
      if (currentTable.length > 0) {
        // If table has at least 2 lines (header + data/separator), treat as table; otherwise fallback to text
        if (currentTable.length >= 2) {
          blocks.push({ type: 'table', lines: [...currentTable] });
        } else {
          currentText.push(...currentTable);
        }
        currentTable = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushText();
        currentTable.push(trimmed);
      } else {
        flushTable();
        currentText.push(line);
      }
    }
    flushText();
    flushTable();

    return (
      <div className="space-y-3 text-xs sm:text-[13px] leading-relaxed">
        {blocks.map((block, bIdx) => {
          if (block.type === 'table') {
            const tableRows = block.lines;
            const headerLine = tableRows[0];
            const headerCells = headerLine.split('|').slice(1, -1).map(c => c.trim());
            const dataRows = tableRows.slice(1).filter(r => !r.includes('---'));

            return (
              <div key={bIdx} className="overflow-x-auto my-2.5 rounded-xl border border-slate-700/80 bg-slate-950/70 shadow-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/95 border-b border-slate-700 text-cyan-300 font-mono font-bold">
                      {headerCells.map((hCell, hIdx) => (
                        <th key={hIdx} className="px-3.5 py-2.5 text-[11px] uppercase tracking-wider whitespace-nowrap">
                          {hCell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((rowLine, rIdx) => {
                      const cells = rowLine.split('|').slice(1, -1).map(c => c.trim());
                      const rowContext = rowLine;
                      return (
                        <tr 
                          key={rIdx} 
                          className="hover:bg-slate-800/50 border-b border-slate-800/70 text-slate-200 transition-colors last:border-b-0"
                        >
                          {cells.map((cell, cIdx) => {
                            const columnHeader = headerCells[cIdx] || '';
                            const combinedContext = `${columnHeader} ${rowContext}`;
                            return (
                              <td key={cIdx} className="px-3.5 py-2 text-xs font-mono">
                                <span dangerouslySetInnerHTML={{ __html: highlightFormatting(cell, combinedContext) }} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }

          // Text block
          return (
            <div key={bIdx} className="space-y-1.5">
              {block.lines.map((p, pIdx) => {
                if (!p.trim()) return <div key={pIdx} className="h-1" />;

                // Bullet point
                if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
                  const content = p.trim().substring(2);
                  return (
                    <div key={pIdx} className="flex items-start gap-2 pl-1">
                      <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                      <span dangerouslySetInnerHTML={{ __html: highlightFormatting(content) }} />
                    </div>
                  );
                }

                return (
                  <p key={pIdx} dangerouslySetInnerHTML={{ __html: highlightFormatting(p) }} />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      style={{ height: isFullscreen ? 'calc(100vh - 80px)' : `${chatHeight}px` }}
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-premium-2xl overflow-hidden animate-fade-in font-sans transition-[height] duration-150 ${isResizingRef.current ? 'select-none transition-none' : ''}`}
    >
      
      {/* 1. TOP EXECUTIVE HEADER */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/40">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-sm" title="Online" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                Skywalker
                <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
                  Gestor IA
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Inteligência executiva integrada com acesso irrestrito a todas as abas e dados.
            </p>
          </div>
        </div>

        {/* Quick telemetry & Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-emerald-400" />
              Caixa: <b className="text-white">R$ {financials.currentCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <CarFront className="h-3 w-3 text-cyan-400" />
              Frota: <b className="text-white">{vehicles.filter(v => !v.isDeleted).length} carros</b>
            </span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Restaurar tamanho padrão" : "Expandir janela do chat"}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline text-[11px] font-medium">{isFullscreen ? "Restaurar" : "Expandir"}</span>
          </button>

          <button
            onClick={handleClearChat}
            title="Reiniciar Conversa"
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">Limpar</span>
          </button>
        </div>
      </div>

      {/* 2. QUICK PROMPT CHIPS */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0 mr-1 font-mono">
          <Zap className="h-3 w-3 text-amber-400" />
          Ações Rápidas:
        </span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendMessage(qp.prompt)}
            className="text-[11px] font-medium whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-700/60 hover:border-cyan-500/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* 3. MESSAGE THREAD CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {!isUser && (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shrink-0 shadow-md border border-cyan-400/30 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[88%] sm:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-br from-cyan-600 to-brand-600 text-white rounded-tr-xs border border-cyan-400/30'
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-xs border border-slate-700/80 shadow-inner'
                  }`}
                >
                  {/* Render attachments in user message if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att, attIdx) => (
                        att.isImage ? (
                          <div 
                            key={attIdx} 
                            onClick={() => setSelectedPreviewImage(att.dataUrl)}
                            className="group relative rounded-lg overflow-hidden border border-white/20 bg-black/50 cursor-pointer hover:border-cyan-400 transition-all shadow-md"
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="h-24 w-auto max-w-[180px] object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="h-5 w-5 drop-shadow" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/80 px-1.5 py-0.5 text-[9px] text-slate-200 truncate font-mono">
                              {att.name}
                            </div>
                          </div>
                        ) : att.isAudio || att.type.startsWith('audio/') ? (
                          <div
                            key={attIdx}
                            className="flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-slate-950/70 border border-white/20 text-white text-xs shadow-sm min-w-[230px]"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] text-cyan-200 font-mono">
                              <span className="flex items-center gap-1 font-bold truncate">
                                <Volume2 className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                                {att.name}
                              </span>
                              <span className="text-slate-300 shrink-0">{(att.size / 1024).toFixed(0)} KB</span>
                            </div>
                            <audio controls src={att.dataUrl} className="h-8 w-full max-w-[260px]" />
                          </div>
                        ) : (
                          <div 
                            key={attIdx} 
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-xs shadow-sm"
                          >
                            <FileText className="h-4 w-4 text-cyan-300 shrink-0" />
                            <div className="truncate max-w-[150px] sm:max-w-[200px]">
                              <p className="font-medium truncate text-[11px]">{att.name}</p>
                              <p className="text-[9px] text-slate-400 font-mono">{(att.size / 1024).toFixed(0)} KB</p>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {isUser ? (
                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    renderFormattedText(msg.text)
                  )}

                  {/* Render generated downloadable reports if any */}
                  {msg.generatedReports && msg.generatedReports.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/80 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1 font-mono">
                        <FileDown className="h-3.5 w-3.5 text-cyan-400" />
                        Relatório Emitido para Download:
                      </span>
                      {msg.generatedReports.map((rep, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{rep.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Formato principal: <strong className="text-cyan-300 uppercase">{rep.format}</strong> • Escolha o formato para baixar:
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => triggerReportDownload(rep, 'pdf')}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold font-mono flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReportDownload(rep, 'csv')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-bold font-mono flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <Download className="h-3 w-3" />
                              CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReportDownload(rep, 'txt')}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold font-mono flex items-center gap-1 transition-all cursor-pointer"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReportDownload(rep, 'json')}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold font-mono flex items-center gap-1 transition-all cursor-pointer"
                            >
                              JSON
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render executed actions cards if any */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="h-3 w-3" />
                        Ação Executada no Sistema:
                      </span>
                      {msg.actionsExecuted.map((act, aIdx) => (
                        <div
                          key={aIdx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-200"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-white text-[11px]">{act.type}:</span>
                            <span className="truncate text-slate-300 text-[11px]">{act.description}</span>
                          </div>
                          {act.targetTab && (
                            <button
                              onClick={() => onNavigateTab(act.targetTab)}
                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 shrink-0 hover:underline cursor-pointer"
                            >
                              Ver na aba
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick export toolbar on every Skywalker response */}
                  {!isUser && msg.id !== 'msg_welcome' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-end gap-1.5">
                      <span className="text-[9.5px] text-slate-400 font-mono mr-auto flex items-center gap-1">
                        <FileDown className="h-3 w-3 text-cyan-400" />
                        Exportar resposta:
                      </span>
                      <button
                        type="button"
                        onClick={() => exportChatMessageAsFile(msg, 'pdf')}
                        className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Baixar esta resposta como relatório PDF"
                      >
                        <Download className="h-2.5 w-2.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => exportChatMessageAsFile(msg, 'csv')}
                        className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Baixar dados como planilha CSV"
                      >
                        <Download className="h-2.5 w-2.5" />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportChatMessageAsFile(msg, 'txt')}
                        className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Baixar como arquivo de texto TXT"
                      >
                        TXT
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[9.5px] text-slate-500 font-mono mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>

              {isUser && (
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0 border border-slate-700 mt-0.5 shadow-sm">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 justify-start animate-fade-in">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shrink-0 shadow-md border border-cyan-400/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-inner flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400 font-mono ml-1">Skywalker processando dados...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. INPUT COMPONENT */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
          }
        }}
        className={`p-3 sm:p-4 bg-slate-950 border-t transition-colors shrink-0 ${
          isDragging ? 'bg-cyan-950/40 border-cyan-500' : 'border-slate-800/80'
        }`}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,application/pdf,.csv,.txt,.mp3,.wav,.ogg,.m4a,.webm"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Active Voice Recording Banner */}
        {isRecording && (
          <div className="mb-2.5 px-3.5 py-2.5 bg-rose-950/80 border border-rose-500/60 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-fade-in shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-rose-200 font-mono">
                Gravando Áudio para o Skywalker... ({String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelAudioRecording}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => stopAudioRecording(false)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono flex items-center gap-1 cursor-pointer"
              >
                <Square className="h-3 w-3" />
                Parar e Anexar
              </button>
              <button
                type="button"
                onClick={() => stopAudioRecording(true)}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-brand-500 hover:from-cyan-400 hover:to-brand-400 text-white text-xs font-bold font-mono flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <Send className="h-3 w-3" />
                Enviar Áudio Agora
              </button>
            </div>
          </div>
        )}

        {/* Attachment chips bar */}
        {attachments.length > 0 && (
          <div className="mb-2 p-2 bg-slate-900/90 rounded-xl border border-slate-700/80 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold px-1 flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {attachments.length} Anexo(s):
            </span>
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 shadow-sm"
              >
                {att.isImage ? (
                  <img 
                    src={att.dataUrl} 
                    alt={att.name} 
                    className="h-5 w-5 rounded object-cover cursor-pointer" 
                    onClick={() => setSelectedPreviewImage(att.dataUrl)} 
                  />
                ) : att.isAudio || att.type.startsWith('audio/') ? (
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <audio controls src={att.dataUrl} className="h-6 w-36" />
                  </div>
                ) : (
                  <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="truncate max-w-[120px] text-[11px] font-medium">{att.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">({(att.size / 1024).toFixed(0)}KB)</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                  title="Remover anexo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAttachments([])}
              className="text-[10px] text-slate-400 hover:text-rose-400 underline font-mono ml-auto px-1 cursor-pointer"
            >
              Limpar todos
            </button>
          </div>
        )}

        {isDragging && (
          <div className="mb-2 p-3 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-950/60 flex items-center justify-center gap-2 text-cyan-200 text-xs font-mono animate-pulse">
            <UploadCloud className="h-5 w-5 text-cyan-400" />
            <span>Solte os arquivos, fotos ou áudios aqui para anexar</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex flex-col gap-1.5"
        >
          <div className="relative w-full">
            <textarea
              ref={inputRef}
              rows={4}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              placeholder={attachments.length > 0 ? "Adicione instruções sobre o anexo/áudio ou pressione Enter para o Skywalker analisar..." : "Pergunte ao Skywalker, grave um áudio, peça um relatório em PDF/CSV ou anexe fotos/documentos..."}
              className="w-full min-h-[96px] sm:min-h-[108px] max-h-56 px-4 py-3 pr-36 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-sans resize-y leading-relaxed scrollbar-thin shadow-inner"
            />
            
            {/* Input Action Buttons (Microphone, Attachment & Send) */}
            <div className="absolute right-2.5 bottom-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => (isRecording ? stopAudioRecording(true) : startAudioRecording())}
                disabled={isLoading}
                className={`p-2.5 border rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-40 flex items-center justify-center ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-400 border-slate-700'
                }`}
                title={isRecording ? "Parar gravação e enviar áudio para o Skywalker" : "Gravar comando de voz / áudio para o Skywalker"}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-300 border border-slate-700 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-40"
                title="Anexar foto, áudio, CRLV, nota fiscal, comprovante ou documento (PDF, imagens, áudio, CSV)"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="submit"
                disabled={(!inputMessage.trim() && attachments.length === 0) || isLoading}
                className="p-2.5 bg-gradient-to-r from-cyan-500 to-brand-500 hover:from-cyan-400 hover:to-brand-400 disabled:opacity-40 disabled:hover:from-cyan-500 text-white rounded-xl transition-all cursor-pointer shadow-md disabled:cursor-not-allowed flex items-center justify-center"
                title="Enviar mensagem para Skywalker (Enter)"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono">
            <span>Pressione <strong className="text-slate-400 font-bold">Enter</strong> para enviar • <strong className="text-slate-400 font-bold">Microfone</strong> para enviar áudio • Arraste arquivos para anexar</span>
            <span className="hidden sm:inline">Suporta Voz/Áudio, Relatórios em PDF/CSV/TXT/JSON, Fotos e Documentos</span>
          </div>
        </form>
      </div>

      {/* 5. INTERACTIVE MOUSE RESIZE HANDLE BAR & CORNER GRIP */}
      {!isFullscreen && (
        <div
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          title="Clique e arraste com o mouse para redimensionar a altura da janela do chat"
          className={`relative group h-6 bg-slate-950 border-t border-slate-800/80 cursor-ns-resize flex items-center justify-center gap-2 transition-all select-none shrink-0 ${
            isResizing ? 'bg-cyan-950/70 border-cyan-500/60' : 'hover:bg-cyan-950/40 hover:border-slate-700'
          }`}
        >
          <div className="w-8 h-1 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
          <span className="text-[9px] text-slate-400 group-hover:text-cyan-300 font-mono tracking-widest uppercase transition-colors flex items-center gap-1.5 font-bold">
            ↕ Arraste com o mouse para Redimensionar {isResizing && <span className="text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-500/40">({chatHeight}px)</span>}
          </span>
          <div className="w-8 h-1 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />

          {/* Bottom-right corner grip */}
          <div
            onMouseDown={startResizing}
            onTouchStart={startResizing}
            title="Arraste para redimensionar"
            className="absolute right-2 bottom-1 w-4 h-4 cursor-se-resize flex flex-col justify-end items-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-3 h-0.5 bg-cyan-400/80 rounded-full" />
            <div className="w-2 h-0.5 bg-cyan-400/80 rounded-full" />
            <div className="w-1 h-0.5 bg-cyan-400/80 rounded-full" />
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {selectedPreviewImage && (
        <div 
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-mono text-cyan-300 font-bold flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Visualização de Imagem Anexada
              </span>
              <button
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img 
              src={selectedPreviewImage} 
              alt="Anexo ampliado" 
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain mx-auto" 
            />
          </div>
        </div>
      )}

    </div>
  );
};
