import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Role } from '../../types';

export function Login() {
  const navigate = useNavigate();
  const { login, currentUser, role } = useAuth();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser && role) {
      if (role === Role.Vendor) {
        navigate('/vendor-portal', { replace: true });
      } else if (role === Role.User) {
        navigate('/portal', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [currentUser, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(loginId, password);

      if (res.success) {
        const session = JSON.parse(localStorage.getItem('urban_furniture_session') || '{}');
        if (session.role === Role.Vendor) {
          navigate('/vendor-portal');
        } else if (session.role === Role.User) {
          navigate('/portal');
        } else {
          navigate('/');
        }
      } else {
        setError(res.message || 'Invalid Login ID or Password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
        <div>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white font-black text-xl flex items-center justify-center shadow-md mb-3">
            UF
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
            Urban Furniture
          </h2>
          <p className="mt-1.5 text-center text-sm text-slate-500 font-medium">
            ERP & Enterprise Portal
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-rose-50 text-rose-800 p-4 rounded-xl text-sm border border-rose-200/80 flex items-start gap-3 shadow-xs">
              <span className="text-rose-600 font-bold text-base">⚠️</span>
              <div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Login ID / Email"
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. admin123, vendor123"
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
            Demo Quick Logins
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setLoginId('admin123');
                setPassword('Password@123');
                setError('');
              }}
              className="px-2 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all text-center cursor-pointer"
            >
              👑 Master Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginId('subadmin');
                setPassword('Password@123');
                setError('');
              }}
              className="px-2 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all text-center cursor-pointer"
            >
              🛡️ Sub-Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginId('vendor123');
                setPassword('Password@123');
                setError('');
              }}
              className="px-2 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200 hover:border-purple-300 text-xs font-semibold rounded-lg border transition-all text-center cursor-pointer"
            >
              🏬 Vendor
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginId('account123');
                setPassword('Password@123');
                setError('');
              }}
              className="px-2 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all text-center cursor-pointer"
            >
              📊 Accountant
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginId('johnuser');
                setPassword('Password@123');
                setError('');
              }}
              className="px-2 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all text-center cursor-pointer col-span-2"
            >
              👤 Customer John
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 pt-2 text-sm">
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
            Forgot Password
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
            Create Account / Vendor Signup
          </Link>
        </div>
      </div>
    </div>
  );
}
