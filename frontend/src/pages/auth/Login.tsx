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

  useEffect(() => {
    if (currentUser && role) {
      if (role === Role.User) {
        navigate('/portal', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [currentUser, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = await login(loginId, password);
    
    if (success) {
      const session = JSON.parse(localStorage.getItem('urban_furniture_session') || '{}');
      if (session.role === Role.User) {
        navigate('/portal');
      } else {
        navigate('/');
      }
    } else {
      setError('Invalid Login Id or Password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
            Urban Furniture
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Accounting System
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100 text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <Input
              label="Login ID"
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter your login ID"
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
            <Button type="submit" className="w-full" size="lg">
              SIGN IN
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center mb-2">
            Demo Quick Login
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setLoginId('admin123'); setPassword('Password@123'); setError(''); }}
              className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-medium rounded border border-slate-200 transition-colors text-center"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => { setLoginId('account123'); setPassword('Password@123'); setError(''); }}
              className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-medium rounded border border-slate-200 transition-colors text-center"
            >
              Accountant
            </button>
            <button
              type="button"
              onClick={() => { setLoginId('johnuser'); setPassword('Password@123'); setError(''); }}
              className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-medium rounded border border-slate-200 transition-colors text-center"
            >
              Customer
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 mt-6 text-sm">
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
            Forgot Password
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
