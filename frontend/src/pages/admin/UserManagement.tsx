import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Role, type User } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { validateLoginId, validatePassword } from '../../utils/validation';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Filter, 
  CheckCircle, 
  Ban, 
  Trash2, 
  RefreshCw, 
  Store, 
  User as UserIcon, 
  Crown,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

export function UserManagement() {
  const { currentUser, role, getAllUsers, toggleSuspendUser, deleteUser, createUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State for New User / Sub-Admin
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    name: '',
    loginId: '',
    email: '',
    role: Role.SubAdmin,
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleToggleSuspend = async (user: User) => {
    if (user.isMasterAdmin || user.role === Role.MasterAdmin || user.loginId === 'admin123') {
      showToast('error', 'Master Administrator cannot be suspended.');
      return;
    }

    const action = user.isSuspended ? 'activate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} user "${user.name}" (${user.loginId})?`)) {
      return;
    }

    const res = await toggleSuspendUser(user.id);
    if (res.success) {
      showToast('success', res.message || `User status updated successfully`);
      fetchUsers();
    } else {
      showToast('error', res.message || 'Failed to update user status');
    }
  };

  const handleDelete = async (user: User) => {
    if (user.isMasterAdmin || user.role === Role.MasterAdmin || user.loginId === 'admin123') {
      showToast('error', 'Master Administrator account cannot be deleted.');
      return;
    }

    if (!window.confirm(`Permanently delete account for "${user.name}"? This action cannot be undone.`)) {
      return;
    }

    const ok = await deleteUser(user.id);
    if (ok) {
      showToast('success', `User ${user.name} removed from system`);
      fetchUsers();
    } else {
      showToast('error', 'Failed to delete user');
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrors({});

    const errs: Record<string, string> = {};
    if (!modalData.name.trim()) errs.name = 'Name is required';
    const lErr = validateLoginId(modalData.loginId);
    if (lErr) errs.loginId = lErr;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalData.email)) errs.email = 'Invalid email';
    const pErr = validatePassword(modalData.password);
    if (pErr) errs.password = pErr;
    if (modalData.password !== modalData.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setModalErrors(errs);
      return;
    }

    setModalSubmitting(true);
    const ok = await createUser({
      name: modalData.name.trim(),
      loginId: modalData.loginId.trim().toLowerCase(),
      email: modalData.email.trim().toLowerCase(),
      role: modalData.role,
      phone: modalData.phone.trim(),
      password: modalData.password,
    });
    setModalSubmitting(false);

    if (ok) {
      showToast('success', `User ${modalData.name} (${modalData.role}) created successfully!`);
      setIsModalOpen(false);
      setModalData({
        name: '',
        loginId: '',
        email: '',
        role: Role.SubAdmin,
        phone: '',
        password: '',
        confirmPassword: '',
      });
      fetchUsers();
    } else {
      setModalErrors({ submit: 'Failed to create user. Login ID or Email might already exist.' });
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !debouncedSearch ||
        u.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        u.loginId?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && !u.isSuspended) ||
        (statusFilter === 'SUSPENDED' && u.isSuspended);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, debouncedSearch, roleFilter, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, pageSize]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === Role.MasterAdmin || u.role === Role.Administrator || u.role === Role.SubAdmin).length,
      vendors: users.filter((u) => u.role === Role.Vendor).length,
      customers: users.filter((u) => u.role === Role.User).length,
      suspended: users.filter((u) => u.isSuspended).length,
    };
  }, [users]);

  const getRoleBadge = (userRole: Role) => {
    switch (userRole) {
      case Role.MasterAdmin:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Crown size={13} className="text-amber-600" /> Master Admin
          </span>
        );
      case Role.SubAdmin:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck size={13} className="text-blue-600" /> Sub Admin
          </span>
        );
      case Role.Administrator:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck size={13} className="text-blue-600" /> Administrator
          </span>
        );
      case Role.Vendor:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <Store size={13} className="text-slate-600" /> Vendor
          </span>
        );
      case Role.Accountant:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            📊 Accountant
          </span>
        );
      case Role.User:
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            👤 Customer
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {actionMessage.type === 'success' ? (
              <CheckCircle size={18} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600" />
            )}
            <span className="text-sm font-semibold">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Administration</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
              <Crown size={12} /> Master Control
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create Sub-Admins, manage permissions, and suspend or activate system accounts.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={fetchUsers}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <UserPlus size={16} />
            <span>Create Sub-Admin / User</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Accounts</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Admins & Sub-Admins</span>
            <ShieldCheck size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">{stats.admins}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Vendor Partners</span>
            <Store size={16} className="text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.vendors}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Customers</span>
            <UserIcon size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">{stats.customers}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Suspended</span>
            <Ban size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{stats.suspended}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, login ID, email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter size={14} />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value={Role.MasterAdmin}>Master Admin</option>
            <option value={Role.SubAdmin}>Sub Admin</option>
            <option value={Role.Administrator}>Administrator</option>
            <option value={Role.Accountant}>Accountant</option>
            <option value={Role.Vendor}>Vendor</option>
            <option value={Role.User}>Customer</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">User / Login ID</th>
                <th className="py-3.5 px-6">Email</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isMaster = u.isMasterAdmin || u.role === Role.MasterAdmin || u.loginId === 'admin123';
                  const initial = u.name ? u.name.charAt(0).toUpperCase() : 'U';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ${
                            isMaster ? 'bg-amber-500' : u.role === Role.Vendor ? 'bg-slate-600' : u.role === Role.SubAdmin ? 'bg-blue-600' : 'bg-slate-600'
                          }`}>
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {u.name}
                              {isMaster && <Crown size={13} className="text-amber-500 fill-amber-500" />}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">@{u.loginId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        {u.email}
                      </td>
                      <td className="py-4 px-6">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="py-4 px-6">
                        {u.isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban size={12} /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isMaster ? (
                            <>
                              <button
                                onClick={() => handleToggleSuspend(u)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                  u.isSuspended
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                                }`}
                              >
                                {u.isSuspended ? 'Activate User' : 'Suspend User'}
                              </button>
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
                              Protected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredUsers.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
            <div className="flex items-center gap-2">
              <span>Showing</span>
              <span className="font-bold text-slate-800">
                {Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)} - {Math.min(currentPage * pageSize, filteredUsers.length)}
              </span>
              <span>of</span>
              <span className="font-bold text-slate-800">{filteredUsers.length}</span>
              <span>accounts</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                  title="First Page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-3 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded-md">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                  title="Last Page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create New System User</h3>
                  <p className="text-xs text-slate-500">Add Sub-Admins, Accountants, Vendors or Customers</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              {modalErrors.submit && (
                <div className="bg-rose-50 text-rose-800 p-3 rounded-xl text-xs font-semibold border border-rose-200">
                  {modalErrors.submit}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name / Company Name"
                  required
                  value={modalData.name}
                  onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                  error={modalErrors.name}
                  placeholder="e.g. Rahul Sharma"
                />

                <Input
                  label="Login ID (6-12 chars)"
                  required
                  value={modalData.loginId}
                  onChange={(e) => setModalData({ ...modalData, loginId: e.target.value })}
                  error={modalErrors.loginId}
                  placeholder="e.g. rahul123"
                />

                <Input
                  label="Email Address"
                  type="email"
                  required
                  value={modalData.email}
                  onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                  error={modalErrors.email}
                  placeholder="rahul@example.com"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={modalData.role}
                    onChange={(e) => setModalData({ ...modalData, role: e.target.value as Role })}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={Role.SubAdmin}>🛡️ Sub-Admin (Operations Manager)</option>
                    <option value={Role.Administrator}>💼 Administrator</option>
                    <option value={Role.Accountant}>📊 Accountant</option>
                    <option value={Role.Vendor}>🏬 Vendor Partner</option>
                    <option value={Role.User}>👤 Customer</option>
                  </select>
                </div>

                <Input
                  label="Phone Number (Optional)"
                  type="tel"
                  value={modalData.phone}
                  onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  value={modalData.password}
                  onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                  error={modalErrors.password}
                  placeholder="Password"
                />

                <div className="sm:col-span-2">
                  <Input
                    label="Re-enter Password"
                    type="password"
                    required
                    value={modalData.confirmPassword}
                    onChange={(e) => setModalData({ ...modalData, confirmPassword: e.target.value })}
                    error={modalErrors.confirmPassword}
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={modalSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {modalSubmitting ? 'Creating User...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
