import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      localStorage.removeItem('loca_current_user');
      sessionStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h1 className="text-lg font-bold text-white mb-2">
              Recuperação do Sistema
            </h1>
            
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Ocorreu uma instabilidade pontual ao carregar o aplicativo. Nossos sistemas de redundância estão ativos para restaurar o acesso imediato.
            </p>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-left mb-6 text-[11px] font-mono text-rose-400 overflow-x-auto max-h-28">
                {this.state.error.message || 'Erro desconhecido'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar Aplicativo
              </button>

              <button
                onClick={this.handleClearAndReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Cache e Entrar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
