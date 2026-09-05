import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Role } from '../../types';
import { validateLoginId, validatePassword } from '../../utils/validation';
import { mockDb } from '../../mock/db';
import { Store, UserCheck, Shield } from 'lucide-react';

export function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [accountType, setAccountType] = useState<'Vendor' | 'Customer'>('Vendor');
  const [formData, setFormData] = useState({
    loginId: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'loginId':
        error = validateLoginId(value);
        if (!error && !mockDb.checkUnique('loginId', value)) {
          error = 'Login ID is already taken.';
        }
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Invalid email format.';
        } else if (!mockDb.checkUnique('email', value)) {
          error = 'Email is already registered.';
        }
        break;
      case 'password':
        error = validatePassword(value);
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
        }
        break;
      case 'confirmPassword':
        if (value !== formData.password) {
          error = 'Passwords do not match.';
        }
        break;
      case 'name':
        if (!value.trim()) error = accountType === 'Vendor' ? 'Vendor / Business Name is required.' : 'Full Name is required.';
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    validateField(e.target.name, e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const keys = ['name', 'loginId', 'email', 'password', 'confirmPassword'] as Array<keyof typeof formData>;
    let isValid = true;
    keys.forEach((key) => {
      if (!validateField(key, formData[key])) {
        isValid = false;
      }
    });

    if (isValid) {
      setLoading(true);
      const chosenRole = accountType === 'Vendor' ? Role.Vendor : Role.User;

      const res = await signup({
        name: formData.name,
        loginId: formData.loginId,
        email: formData.email,
        password: formData.password,
        role: chosenRole,
        phone: formData.phone,
      });

      setLoading(false);

      if (res.success) {
        if (chosenRole === Role.Vendor) {
          navigate('/vendor-portal');
        } else {
          navigate('/portal');
        }
      } else {
        setErrors((prev) => ({ ...prev, submit: res.message || 'Failed to sign up.' }));
      }
    }
  };

  const isFormValid =
    Object.values(errors).every((err) => !err) &&
    formData.name &&
    formData.loginId &&
    formData.email &&
    formData.password &&
    formData.confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
        <div>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white font-black text-xl flex items-center justify-center shadow-md mb-3">
            UF
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
            Join Urban Furniture
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500 font-medium">
            Choose your account type to register
          </p>
        </div>

        {/* Account Type Selection */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => setAccountType('Vendor')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountType === 'Vendor'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store size={16} />
            <span>Vendor Partner</span>
          </button>
          <button
            type="button"
            onClick={() => setAccountType('Customer')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountType === 'Customer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck size={16} />
            <span>Customer</span>
          </button>
        </div>

        {accountType === 'Vendor' && (
          <div className="bg-purple-50/70 border border-purple-200/70 rounded-xl p-3 text-xs text-purple-900 flex items-start gap-2.5">
            <Store size={18} className="text-purple-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Vendor Partner Access:</span> You will get access to the Vendor Portal to list products, supply stock, receive purchase orders, and submit bills.
            </div>
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100 text-center">
              {errors.submit}
            </div>
          )}

          <Input
            label={accountType === 'Vendor' ? 'Vendor / Business Name' : 'Full Name'}
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={accountType === 'Vendor' ? 'e.g. Apex Supplies Ltd' : 'e.g. John Doe'}
            error={errors.name}
          />

          <Input
            label="Login ID (6-12 chars)"
            name="loginId"
            type="text"
            required
            value={formData.loginId}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g. apex123"
            error={errors.loginId}
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g. contact@supplier.com"
            error={errors.email}
          />

          <Input
            label="Phone Number (Optional)"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. +91 98765 43210"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Create a strong password"
            error={errors.password}
          />

          <Input
            label="Re-enter Password"
            name="confirmPassword"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Re-enter your password"
            error={errors.confirmPassword}
          />

          <div className="pt-2">
            <Button
              type="submit"
              className={`w-full h-11 text-sm font-bold ${
                accountType === 'Vendor' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
              }`}
              disabled={!isFormValid || loading}
            >
              {loading ? 'CREATING ACCOUNT...' : accountType === 'Vendor' ? 'REGISTER AS VENDOR' : 'REGISTER AS CUSTOMER'}
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 text-sm">
          <span className="text-slate-500">Already have an account? </span>
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

