import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim()) {
      setIsSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Urban Furniture Accounting
          </p>
        </div>
        
        {!isSent ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-600">
              Enter your Login ID or Email Address, and we'll send you a link to reset your password.
            </p>
            <Input
              label="Login ID or Email"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter ID or Email"
            />

            <div>
              <Button type="submit" className="w-full" size="lg">
                SEND RESET LINK
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-8 bg-green-50 text-green-800 p-6 rounded-md border border-green-200 text-center space-y-4">
            <h3 className="font-semibold text-lg">Reset Link Sent!</h3>
            <p className="text-sm">
              If an account matches <strong>{identifier}</strong>, you will receive a password reset link shortly.
            </p>
          </div>
        )}

        <div className="text-center mt-6 text-sm">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 flex justify-center items-center gap-1">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
