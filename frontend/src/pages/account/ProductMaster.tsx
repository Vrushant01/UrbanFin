import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Product, ProductType, type Category } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Package, Camera } from 'lucide-react';

const DEFAULT_PRODUCT: Partial<Product> = {
  name: '',
  type: ProductType.Goods,
  categoryId: '',
  salesPrice: 0,
  cost: 0
};

export function ProductMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [categoryInput, setCategoryInput] = useState(''); // Text for the create-on-the-fly category

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    setProducts(mockDb.getProducts());
    setCategories(mockDb.getCategories());
  }, [viewMode]);

  // Sync categoryInput with editingProduct.categoryId when editing an existing product
  useEffect(() => {
    if (editingProduct && editingProduct.categoryId) {
      const cat = categories.find(c => c.id === editingProduct.categoryId);
      setCategoryInput(cat ? cat.name : '');
    } else if (editingProduct && !editingProduct.categoryId) {
      setCategoryInput('');
    }
  }, [editingProduct?.categoryId, categories]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (categories.find(c => c.id === p.categoryId)?.name || '').toLowerCase().includes(lower)
    );
  }, [products, categories, searchTerm]);

  // Actions
  const handleNew = () => {
    setEditingProduct({ ...DEFAULT_PRODUCT });
    setCategoryInput('');
    setViewMode('form');
  };

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingProduct(null);
    setViewMode('list');
  };

  const handleSave = () => {
    if (!editingProduct || !editingProduct.name) return;

    let finalCategoryId = editingProduct.categoryId;

    // Handle Create-on-the-fly Category
    if (categoryInput.trim()) {
      const existingCategory = categories.find(c => c.name.toLowerCase() === categoryInput.trim().toLowerCase());
      if (existingCategory) {
        finalCategoryId = existingCategory.id;
      } else {
        // Create new category
        const newCat = mockDb.addCategory(categoryInput.trim());
        setCategories(mockDb.getCategories());
        finalCategoryId = newCat.id;
      }
    }

    const payload = {
      ...editingProduct,
      categoryId: finalCategoryId || ''
    } as Product;

    if (payload.id) {
      mockDb.updateProduct(payload.id, payload);
    } else {
      mockDb.addProduct(payload);
    }
    
    setProducts(mockDb.getProducts());
    setViewMode('list');
    setEditingProduct(null);
  };

  const handleNewFromForm = () => {
    setEditingProduct({ ...DEFAULT_PRODUCT });
    setCategoryInput('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingProduct(prev => prev ? { ...prev, image: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  // List View configuration
  const columns: Column<Product>[] = [
    {
      key: 'image',
      header: '',
      render: (p) => p.image ? 
        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-md object-cover border border-slate-200" /> : 
        <div className="w-10 h-10 rounded-md bg-slate-200 flex items-center justify-center text-slate-500"><Package size={20} /></div>
    },
    { key: 'name', header: 'Product Name' },
    { key: 'category', header: 'Category', render: (p) => categories.find(c => c.id === p.categoryId)?.name || '-' },
    { key: 'type', header: 'Type' },
    { key: 'salesPrice', header: 'Sales Price', render: (p) => `Rs. ${p.salesPrice.toFixed(2)}` },
    { key: 'cost', header: 'Cost', render: (p) => `Rs. ${p.cost.toFixed(2)}` }
  ];

  // Kanban View configuration
  const renderCard = (p: Product) => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="h-40 bg-slate-100 flex items-center justify-center relative">
        {p.image ? 
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : 
          <Package size={48} className="text-slate-300" />
        }
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="bg-white/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded text-slate-700 shadow-sm">
            {categories.find(c => c.id === p.categoryId)?.name || 'Uncategorized'}
          </span>
          <span className="bg-indigo-600/90 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded text-white shadow-sm">
            {p.type}
          </span>
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-slate-800 text-lg mb-4 line-clamp-2">{p.name}</h3>
        <div className="mt-auto grid grid-cols-2 gap-2 text-sm border-t border-slate-100 pt-3">
          <div>
            <p className="text-slate-400 text-xs font-medium">Sales Price</p>
            <p className="font-semibold text-slate-800">Rs. {p.salesPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">Cost</p>
            <p className="font-semibold text-slate-600">Rs. {p.cost.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const isFormValid = !!(editingProduct?.name && categoryInput.trim());

  return (
    <MasterLayout
      title="Products"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredProducts} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={p => p.id} 
        />
      )}
      
      {viewMode === 'kanban' && (
        <MasterKanbanView 
          data={filteredProducts} 
          renderCard={renderCard} 
          onCardClick={handleEdit} 
          keyExtractor={p => p.id} 
        />
      )}

      {viewMode === 'form' && editingProduct && (
        <MasterFormView onSave={handleSave} onNew={handleNewFromForm} isFormValid={isFormValid}>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Left Col - Image */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div 
                className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {editingProduct.image ? (
                  <>
                    <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white" size={24} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Camera size={32} className="mb-2" />
                    <span className="text-xs font-medium">Upload Image</span>
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
            <div className="flex-grow space-y-6">
              <Input 
                label="Product Name" 
                required 
                value={editingProduct.name || ''} 
                onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="e.g. Air Conditioner"
                className="text-lg font-medium"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={editingProduct.type || ProductType.Goods}
                    onChange={e => setEditingProduct({ ...editingProduct, type: e.target.value as ProductType })}
                  >
                    <option value={ProductType.Goods}>Goods</option>
                    <option value={ProductType.Service}>Service</option>
                    <option value={ProductType.Combo}>Combo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category <span className="text-xs text-slate-400 font-normal ml-1">(Type to create new)</span>
                  </label>
                  <input
                    list="categories-list"
                    required
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Select or type new category"
                    value={categoryInput}
                    onChange={e => setCategoryInput(e.target.value)}
                  />
                  <datalist id="categories-list">
                    {categories.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <Input 
                    label="Sales Price (Rs.)" 
                    type="number" 
                    min="0"
                    step="0.01"
                    required
                    value={editingProduct.salesPrice || ''} 
                    onChange={e => setEditingProduct({ ...editingProduct, salesPrice: parseFloat(e.target.value) || 0 })}
                  />
                  
                  <Input 
                    label="Cost (Rs.)" 
                    type="number" 
                    min="0"
                    step="0.01"
                    required
                    value={editingProduct.cost || ''} 
                    onChange={e => setEditingProduct({ ...editingProduct, cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
