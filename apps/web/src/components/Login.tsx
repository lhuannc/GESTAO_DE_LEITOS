
import React, { useState } from 'react';
import { User } from '@gestao-leitos/types';
import { trpc } from '../lib/trpc';
import { ShieldCheck, Fingerprint, Lock, Loader2, Hospital, Building2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // JWT cookie is automatically set by backend (HttpOnly)
      // No need to store anything in localStorage
      // No need to reload page - cookies are sent automatically
      onLoginSuccess(data.user);
    },
    onError: (err) => {
      setError(err.message || 'Login ou senha incorretos. Verifique suas credenciais.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Remove formatting from CPF (dots and dashes)
    const cleanCpf = login.replace(/\D/g, '');
    
    loginMutation.mutate({ cpf: cleanCpf, password });
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50">
      {/* Left Side - Hospital Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-sky-900 via-sky-800 to-emerald-900">
        <div className="absolute inset-0 bg-black/20 z-10" />
        <img 
          src="/hospital.png" 
          alt="Hospital Municipal Ronaldo Gazolla" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay Content */}
        <div className="relative z-20 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                <Building2 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white/90">RIOSAUDE</h2>
                <p className="text-xs text-white/70 font-medium">Sistema de Gestão Hospitalar</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl xl:text-5xl font-black leading-tight mb-4">
                Hospital Municipal<br />
                Ronaldo Gazolla
              </h1>
              <p className="text-lg text-white/80 font-medium max-w-md">
                Gestão inteligente de leitos e fluxos operacionais para excelência no atendimento.
              </p>
            </div>
            
            <div className="flex gap-8 pt-6 border-t border-white/20">
              <div>
                <p className="text-3xl font-black">24/7</p>
                <p className="text-sm text-white/70 font-medium">Disponibilidade</p>
              </div>
              <div>
                <p className="text-3xl font-black">99.9%</p>
                <p className="text-sm text-white/70 font-medium">Uptime SLA</p>
              </div>
              <div>
                <p className="text-3xl font-black">100%</p>
                <p className="text-sm text-white/70 font-medium">Seguro</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-right-4 duration-500">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-500/10 rounded-2xl mb-4 border border-sky-500/20 text-sky-600">
              <Hospital size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Gestão de Leitos</h1>
            <p className="text-slate-500 font-medium text-sm">RIOSAUDE</p>
          </div>

          {/* Login Form */}
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">Bem-vindo</h2>
              <p className="text-slate-500 font-medium text-sm">Entre com suas credenciais para acessar o sistema</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                  Login de Acesso
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-600 transition-colors">
                    <Fingerprint size={18} />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={login} 
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none text-slate-800 text-sm font-bold transition-all placeholder:text-slate-400"
                    placeholder="Digite seu login"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                  Senha
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-600 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none text-slate-800 text-sm font-bold transition-all placeholder:text-slate-400"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in duration-200">
                  <ShieldCheck size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-rose-700 leading-relaxed">{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loginMutation.isPending}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-black uppercase text-sm tracking-wider shadow-lg shadow-sky-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Suporte Técnico: (21) 4004-HIGI
              </p>
            </div>
          </div>

          <div className="mt-6 text-center flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Privacidade</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Termos</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Segurança</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
