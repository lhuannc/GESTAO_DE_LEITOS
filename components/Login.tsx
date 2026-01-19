
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../backend';
import { ShieldCheck, Fingerprint, Lock, Loader2, Hospital } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validação feita no "backend" conforme solicitado
      const user = await db.authenticate(login, password);
      
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Login ou senha incorretos. Verifique suas credenciais.');
      }
    } catch (err) {
      setError('Erro ao processar autenticação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-sky-500/10 rounded-3xl mb-6 border border-sky-500/20 text-sky-500 shadow-inner">
              <Hospital size={40} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">HigiBed</h1>
            <p className="text-slate-400 font-medium text-sm">Portal de Gestão Hospitalar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Login de Acesso</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-500 transition-colors">
                    <Fingerprint size={18} />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={login} 
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none text-white text-sm font-bold transition-all placeholder:text-slate-600"
                    placeholder="Ex: ADMIN ou seu login"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Senha Secreta</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none text-white text-sm font-bold transition-all placeholder:text-slate-600"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                <ShieldCheck size={18} className="text-rose-500 shrink-0" />
                <p className="text-[11px] font-bold text-rose-200 leading-tight">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-xl shadow-sky-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Suporte Técnico: (11) 4004-HIGI</p>
          </div>
        </div>
        
        <div className="mt-8 text-center flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
           <span>Privacidade</span>
           <span className="w-1 h-1 rounded-full bg-slate-800" />
           <span>Termos</span>
           <span className="w-1 h-1 rounded-full bg-slate-800" />
           <span>SLA 99.9%</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
