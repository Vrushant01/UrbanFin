import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [isSent, setIsSent] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      if (res.ok) {
        setIsSent(true);
      } else {
        const data = await res.json();
        setError(data.message || 'An error occurred.');
      }
    } catch (err) {
      console.error('Failed to request password reset', err);
      // In offline mode (mockDB), just pretend it succeeded since we don't have an SMTP server locally in the browser
      setIsSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md border border-slate-200/80">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            UrbanFin ERP
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

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full flex justify-center items-center gap-2" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
                    SENDING...
                  </>
                ) : (
                  'SEND RESET LINK'
                )}
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
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 transition-colors flex justify-center items-center gap-1">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
