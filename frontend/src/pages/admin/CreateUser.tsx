import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Role } from '../../types';
import { validateLoginId, validatePassword } from '../../utils/validation';
import { mockDb } from '../../mock/db';

export function CreateUser() {
  const navigate = useNavigate();
  const { createUser } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    loginId: '',
    email: '',
    role: Role.Accountant,
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    setSuccessMsg('');
    
    // Validate all fields
    let isValid = true;
    (Object.keys(formData) as Array<keyof typeof formData>).forEach(key => {
      if (key !== 'role' && !validateField(key, formData[key])) {
        isValid = false;
      }
    });

    if (isValid) {
      const success = await createUser({
        name: formData.name,
        loginId: formData.loginId,
        email: formData.email,
        role: formData.role,
        password: formData.password
      });
      
      if (success) {
        setSuccessMsg(`User ${formData.name} created successfully!`);
        // Reset form
        setFormData({
          name: '',
          loginId: '',
          email: '',
          role: Role.Accountant,
          password: '',
          confirmPassword: ''
        });
      } else {
        setErrors(prev => ({ ...prev, submit: 'Failed to create user.' }));
      }
    }
  };

  const isFormValid = Object.keys(errors).every(key => key === 'submit' ? true : !errors[key]) && 
                      formData.name && formData.loginId && formData.email && formData.password && formData.confirmPassword;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New User</h2>
        
        {successMsg && (
          <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-md border border-green-200">
            {successMsg}
          </div>
        )}

        {errors.submit && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.name}
            />
            
            <Input
              label="Login ID"
              name="loginId"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={Role.Administrator}>Administrator</option>
                <option value={Role.Accountant}>Accountant</option>
                <option value={Role.User}>User (Contact)</option>
              </select>
            </div>

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
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-slate-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid}
            >
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
