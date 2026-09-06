import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X, Loader2, Check } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache } from '../../utils/clientCache';

export interface SearchableOption {
  id: string;
  name: string;
  subtitle?: string;
  price?: number;
  badge?: string;
  raw?: any;
}

export interface SearchableSelectProps {
  value?: string;
  onChange: (value: string, option?: SearchableOption) => void;
  options?: SearchableOption[];
  asyncSearchUrl?: string; // e.g. '/api/contacts?type=Customer' or '/api/products'
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  allowClear?: boolean;
  label?: string;
  error?: string;
  id?: string;
}

export function SearchableSelect({
  value = '',
  onChange,
  options = [],
  asyncSearchUrl,
  placeholder = 'Select an option...',
  disabled = false,
  required = false,
  className = '',
  size = 'md',
  allowClear = true,
  label,
  error,
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<SearchableOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedInput = useDebounce(inputValue, 250);

  // Map to hold known options by id for label resolution
  const knownOptionsMap = useMemo(() => {
    const map = new Map<string, SearchableOption>();
    options.forEach(opt => map.set(opt.id, opt));
    remoteOptions.forEach(opt => map.set(opt.id, opt));
    return map;
  }, [options, remoteOptions]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return knownOptionsMap.get(value) || options.find(o => o.id === value) || null;
  }, [value, knownOptionsMap, options]);

  // Sync input value when external value changes or when not actively typing
  useEffect(() => {
    if (!isTyping) {
      if (selectedOption) {
        setInputValue(selectedOption.name);
      } else if (!value) {
        setInputValue('');
      }
    }
  }, [value, selectedOption, isTyping]);

  // Debounced server search when typing
  useEffect(() => {
    let isCancelled = false;

    async function performAsyncSearch() {
      if (!asyncSearchUrl || !isTyping) return;

      const trimmed = debouncedInput.trim();
      setIsLoading(true);

      try {
        const separator = asyncSearchUrl.includes('?') ? '&' : '?';
        const url = `${asyncSearchUrl}${separator}search=${encodeURIComponent(trimmed)}`;
        const data = await fetchWithCache<any[]>(url, undefined, 30);

        if (!isCancelled) {
          const formatted: SearchableOption[] = (Array.isArray(data) ? data : []).map(item => ({
            id: item.id || item._id || '',
            name: item.name || '',
            subtitle: item.email || item.phone || item.categoryName || item.type || '',
            price: item.salesPrice !== undefined ? item.salesPrice : item.cost,
            raw: item,
          }));
          setRemoteOptions(formatted);
          setHighlightedIndex(formatted.length > 0 ? 0 : -1);
        }
      } catch (err) {
        if (!isCancelled) {
          setRemoteOptions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (asyncSearchUrl && isTyping) {
      performAsyncSearch();
    }

    return () => {
      isCancelled = true;
    };
  }, [debouncedInput, asyncSearchUrl, isTyping]);

  // Filtered displayed options:
  // If asyncSearchUrl is present and user is typing, use remoteOptions.
  // Otherwise filter given options locally by name/subtitle.
  const displayOptions = useMemo(() => {
    if (asyncSearchUrl && isTyping) {
      return remoteOptions;
    }

    if (!isTyping || !inputValue.trim()) {
      return options.slice(0, 100);
    }

    const term = inputValue.toLowerCase().trim();
    return options
      .filter(
        opt =>
          opt.name.toLowerCase().includes(term) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(term))
      )
      .slice(0, 100);
  }, [asyncSearchUrl, isTyping, remoteOptions, options, inputValue]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        if (selectedOption) {
          setInputValue(selectedOption.name);
        } else if (!value) {
          setInputValue('');
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedOption, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option: SearchableOption) => {
    onChange(option.id, option);
    setInputValue(option.name);
    setIsTyping(false);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputValue('');
    setIsTyping(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < displayOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : displayOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
        handleSelect(displayOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsTyping(false);
      if (selectedOption) setInputValue(selectedOption.name);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setIsTyping(false);
      if (selectedOption) setInputValue(selectedOption.name);
    }
  };

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base',
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div
        className={`relative flex items-center w-full rounded-md border bg-white transition-all shadow-sm
          ${disabled ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 hover:border-slate-400'}
          ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-600' : ''}
          ${error ? 'border-red-500 ring-2 ring-red-500/20' : ''}
        `}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          required={required && !value}
          placeholder={placeholder}
          value={inputValue}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onChange={e => {
            setInputValue(e.target.value);
            setIsTyping(true);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent outline-none font-medium placeholder:text-slate-400 disabled:cursor-not-allowed pr-14 ${sizeClasses[size]}`}
          autoComplete="off"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="animate-spin text-blue-500" size={size === 'sm' ? 14 : 16} />
          )}

          {allowClear && !disabled && value && !isLoading && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Clear selection"
            >
              <X size={size === 'sm' ? 12 : 14} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen(prev => !prev);
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <ChevronDown
              size={size === 'sm' ? 14 : 16}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden animate-in fade-in-50 duration-100 min-w-[240px]">
          {/* Subtle Live Search Status Header */}
          {asyncSearchUrl && (
            <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>{isTyping && inputValue.trim() ? `Searching for "${inputValue}"...` : 'Type to search live database'}</span>
              {isLoading && <span className="text-blue-600 font-semibold flex items-center gap-1">Live Query...</span>}
            </div>
          )}

          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1 focus:outline-none"
            role="listbox"
          >
            {displayOptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-400">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Searching database...</span>
                  </div>
                ) : (
                  <div>
                    <Search className="mx-auto mb-1 text-slate-300" size={20} />
                    <span>No results found for &ldquo;{inputValue}&rdquo;</span>
                  </div>
                )}
              </li>
            ) : (
              displayOptions.map((opt, index) => {
                const isSelected = opt.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={opt.id || index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 text-xs md:text-sm rounded-md cursor-pointer flex items-center justify-between transition-colors
                      ${isHighlighted ? 'bg-blue-50/80 text-blue-900' : 'text-slate-700 hover:bg-slate-50'}
                      ${isSelected ? 'font-semibold bg-blue-50 text-blue-700' : ''}
                    `}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.name}</span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {opt.price !== undefined && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200/60">
                          Rs. {Number(opt.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={16} className="text-blue-600 shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
