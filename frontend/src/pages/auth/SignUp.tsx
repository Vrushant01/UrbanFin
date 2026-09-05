import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { validateLoginId, validatePassword } from '../../utils/validation';
import { mockDb } from '../../mock/db';

export function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState({
    loginId: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match.' }));
        }
        break;
      case 'confirmPassword':
        if (value !== formData.password) {
          error = 'Passwords do not match.';
        }
        break;
      case 'name':
        if (!value.trim()) error = 'Name is required.';
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    const keys = Object.keys(formData) as Array<keyof typeof formData>;
    let isValid = true;
    keys.forEach(key => {
      if (!validateField(key, formData[key])) {
        isValid = false;
      }
    });

    if (isValid) {
      const success = await signup({
        name: formData.name,
        loginId: formData.loginId,
        email: formData.email,
        password: formData.password
      });
      
      if (success) {
        navigate('/');
      } else {
        setErrors(prev => ({ ...prev, submit: 'Failed to sign up.' }));
      }
    }
  };

  const isFormValid = Object.values(errors).every(err => !err) && 
                      Object.values(formData).every(val => val.length > 0);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
            Create an Account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Urban Furniture Accounting
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100 text-center">
              {errors.submit}
            </div>
          )}
          
          <Input
            label="Full Name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.name}
          />
          
          <Input
            label="Login ID"
            name="loginId"
            type="text"
            required
            value={formData.loginId}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.loginId}
          />

          <Input
            label="Email ID"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
          />
          
          <Input
            label="Password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
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
            error={errors.confirmPassword}
          />

          <div className="pt-2">
            <Button type="submit" className="w-full" size="lg" disabled={!isFormValid}>
              SIGN UP
            </Button>
          </div>
        </form>

        <div className="text-center mt-6 text-sm">
          <span className="text-slate-600">Already have an account? </span>
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
