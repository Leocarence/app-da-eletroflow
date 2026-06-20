import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { AppUser } from '../types';
import { EletroflowLogo } from './EletroflowLogo';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
  users: AppUser[];
}

export function LoginScreen({ onLogin, users }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    // Simulate small latency for polished visual feel
    setTimeout(() => {
      const foundUser = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password.trim()
      );

      if (foundUser) {
        onLogin(foundUser);
      } else {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Brand Segment */}
        <div className="flex flex-col items-center justify-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, delay: 0.1 }}
            className="p-3 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl"
          >
            <EletroflowLogo variant="full" iconSize={60} />
          </motion.div>
          
          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-extrabold font-mono mt-3 text-center bg-slate-900/40 px-3 py-1 rounded-full border border-slate-800/50">
            📊 Gestão Integrada de Locações & Recargas
          </p>
        </div>

        {/* Login Form Container */}
        <div id="login-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-indigo-500 rounded-t-2xl" />
          
          <h2 className="text-xl font-bold font-sans text-white mb-2">
            Acesso ao Sistema
          </h2>
          <p className="text-xs text-slate-400 mb-6 font-medium">
            Digite suas credenciais administrativas para prosseguir.
          </p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2.5"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1.5">
                E-mail de Login
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl outline-none text-sm text-slate-200 font-medium font-sans transition-all disabled:opacity-60"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1.5">
                Senha Operacional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl outline-none text-sm text-slate-200 font-mono tracking-widest transition-all disabled:opacity-60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 active:scale-[0.98]"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Autenticar no Sistema'
              )}
            </button>
          </form>
        </div>

        {/* Safe Badge Footer info (No tech-larp, just helpful user assistance as expected) */}
        <div className="text-center mt-6">
          <p className="text-[10px] text-slate-500 font-mono">
            ELETROFLOW LOCAÇÕES LTDA © {new Date().getFullYear()}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
