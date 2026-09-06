import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Contact, ContactType, type Address } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { User, Camera, Trash2 } from 'lucide-react';

import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

const DEFAULT_ADDRESS: Address = { street: '', city: '', state: '', country: '', pincode: '' };
const DEFAULT_CONTACT: Partial<Contact> = {
  name: '',
  type: ContactType.Customer,
  email: '',
  phone: '',
  address: { ...DEFAULT_ADDRESS },
  hasPortalAccess: false
};

export function ContactMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [emailError, setEmailError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const data = await fetchWithCache<Contact[]>(`/api/contacts?search=${encodeURIComponent(query)}`);
      setContacts(data);
    } catch {
      setContacts(mockDb.getContacts());
    }
  }, [debouncedSearch]);

  // Load data on view change and debounced search
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredContacts = contacts;

  // Actions
  const handleNew = () => {
    setEditingContact({ ...DEFAULT_CONTACT, address: { ...DEFAULT_ADDRESS } });
    setEmailError('');
    setViewMode('form');
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact({ ...contact });
    setEmailError('');
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingContact(null);
    setViewMode('list');
  };

  const handleSave = async () => {
    if (!editingContact || !editingContact.name || !editingContact.email) return;

    if (!mockDb.checkUniqueContactEmail(editingContact.email, editingContact.id)) {
      setEmailError('Email must be unique across all contacts.');
      return;
    }

    if (editingContact.id) {
      mockDb.updateContact(editingContact.id, editingContact as Contact);
    } else {
      mockDb.addContact(editingContact as Omit<Contact, 'id'>);
    }
    
    await mockDb.syncWithBackend();
    loadData();
    setViewMode('list');
    setEditingContact(null);
  };

  const handleDelete = async () => {
    if (!editingContact?.id) return;
    if (window.confirm(`Are you sure you want to delete "${editingContact.name}"?`)) {
      mockDb.deleteContact(editingContact.id);
      await mockDb.syncWithBackend();
      loadData();
      setViewMode('list');
      setEditingContact(null);
    }
  };

  const handleNewFromForm = () => {
    setEditingContact({ ...DEFAULT_CONTACT, address: { ...DEFAULT_ADDRESS } });
    setEmailError('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingContact(prev => prev ? { ...prev, image: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  // List View configuration
  const columns: Column<Contact>[] = [
    {
      key: 'image',
      header: '',
      render: (c) => c.image ? 
        <img src={c.image} alt={c.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" /> : 
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><User size={20} /></div>
    },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'type', header: 'Type' }
  ];

  // Kanban View configuration
  const renderCard = (c: Contact) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center h-full">
      {c.image ? 
        <img src={c.image} alt={c.name} className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 mb-4 shadow-sm" /> : 
        <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center text-slate-400 mb-4"><User size={32} /></div>
      }
      <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{c.name}</h3>
      <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded mt-1 mb-3">
        {c.type}
      </span>
      <p className="text-sm text-slate-500 w-full truncate">{c.email}</p>
      <p className="text-sm text-slate-500 mt-1">{c.phone || '-'}</p>
    </div>
  );

  const isFormValid = !!(editingContact?.name && editingContact?.email && !emailError);

  const renderFormActions = () => (
    <div className="flex items-center gap-2">
      <Button 
        type="button" 
        variant="secondary" 
        onClick={handleNewFromForm}
      >
        New
      </Button>
      <Button 
        type="button" 
        variant="primary"
        disabled={!isFormValid}
        onClick={handleSave}
      >
        Confirm
      </Button>
      {editingContact?.id && (
        <Button 
          type="button" 
          variant="outline"
          onClick={handleDelete}
          className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 ml-2"
        >
          <Trash2 size={16} /> Delete
        </Button>
      )}
    </div>
  );

  return (
    <MasterLayout
      title="Contacts"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredContacts} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={c => c.id} 
        />
      )}
      
      {viewMode === 'kanban' && (
        <MasterKanbanView 
          data={filteredContacts} 
          renderCard={renderCard} 
          onCardClick={handleEdit} 
          keyExtractor={c => c.id} 
        />
      )}

      {viewMode === 'form' && editingContact && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Left Col - Image */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div 
                className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {editingContact.image ? (
                  <>
                    <img src={editingContact.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white" size={24} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Camera size={32} className="mb-2" />
                    <span className="text-xs font-medium">Upload</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Right Col - Fields */}
            <div className="flex-grow space-y-8">
              {/* Primary Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Contact Name" 
                  required 
                  value={editingContact.name || ''} 
                  onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="e.g. John Doe"
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={editingContact.type || ContactType.Customer}
                    onChange={e => setEditingContact({ ...editingContact, type: e.target.value as ContactType })}
                  >
                    <option value={ContactType.Customer}>Customer</option>
                    <option value={ContactType.Vendor}>Vendor</option>
                    <option value={ContactType.Both}>Both</option>
                  </select>
                </div>

                <Input 
                  label="Email" 
                  type="email" 
                  required 
                  error={emailError}
                  value={editingContact.email || ''} 
                  onChange={e => {
                    setEditingContact({ ...editingContact, email: e.target.value });
                    if (emailError) setEmailError('');
                  }}
                  onBlur={e => {
                    if (e.target.value && !mockDb.checkUniqueContactEmail(e.target.value, editingContact.id)) {
                      setEmailError('Email must be unique across all contacts.');
                    }
                  }}
                />

                <Input 
                  label="Phone" 
                  value={editingContact.phone || ''} 
                  onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })}
                />
              </div>

              {/* Portal Access flag */}
              {(editingContact.type === ContactType.Customer || editingContact.type === ContactType.Vendor) && (
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="hasPortalAccess"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    checked={editingContact.hasPortalAccess || false}
                    onChange={e => setEditingContact({ ...editingContact, hasPortalAccess: e.target.checked })}
                  />
                  <label htmlFor="hasPortalAccess" className="text-sm font-medium text-slate-700">
                    Provision Portal Access (Customer Portal)
                  </label>
                </div>
              )}

              {/* Address Block */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Address</h3>
                <div className="space-y-4">
                  <Input 
                    label="Street" 
                    value={editingContact.address?.street || ''} 
                    onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, street: e.target.value } })}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="City" 
                      value={editingContact.address?.city || ''} 
                      onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, city: e.target.value } })}
                    />
                    <Input 
                      label="State" 
                      value={editingContact.address?.state || ''} 
                      onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, state: e.target.value } })}
                    />
                    <Input 
                      label="Country" 
                      value={editingContact.address?.country || ''} 
                      onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, country: e.target.value } })}
                    />
                    <Input 
                      label="Pincode" 
                      value={editingContact.address?.pincode || ''} 
                      onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, pincode: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}

