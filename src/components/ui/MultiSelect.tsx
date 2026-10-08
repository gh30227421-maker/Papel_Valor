"use client";

import React, { useState, useRef, useEffect } from 'react';

type Option = {
  value: string;
  label: string;
};

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  icon?: React.ReactNode;
  theme?: "light" | "dark";
};

export default function MultiSelect({ values = [], onChange, options, placeholder = "Seleccionar...", className = "", buttonClassName = "", icon, theme = "light" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setSearchTerm(""), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllOption = (val: string) => val === "Todos" || val === "Todas" || val === "";
  const specificOptions = options.filter(o => !isAllOption(o.value));
  const allSpecificValues = specificOptions.map(o => o.value);

  // Consideramos "Todos" seleccionado si el array incluye la palabra clave, o si TODOS los específicos están seleccionados
  const isAllSelected = values.some(isAllOption) || (allSpecificValues.length > 0 && allSpecificValues.every(opt => values.includes(opt)));

  const handleToggle = (value: string) => {
    if (isAllOption(value)) {
      if (isAllSelected) {
        // Desmarcar todo
        onChange([]);
      } else {
        // Marcar todo
        const allOpt = options.find(o => isAllOption(o.value));
        onChange(allOpt ? [allOpt.value] : ["Todos"]);
      }
      return;
    }
    
    let newValues = [...values];
    
    // Si estaba todo seleccionado y clickeamos uno específico para desmarcar,
    // partimos desde todos seleccionados excepto el clickeado.
    if (isAllSelected) {
      newValues = [...allSpecificValues];
    }
    
    // Toggle standard
    if (newValues.includes(value)) {
      newValues = newValues.filter(v => v !== value);
    } else {
      newValues.push(value);
    }
    
    // Si terminamos seleccionando todos, volvemos a "Todos"
    if (allSpecificValues.length > 0 && allSpecificValues.every(opt => newValues.includes(opt))) {
      const allOpt = options.find(o => isAllOption(o.value));
      newValues = allOpt ? [allOpt.value] : ["Todos"];
    }
    
    onChange(newValues);
  };

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displaySelected = () => {
    if (!values || values.length === 0 || values.includes("Todos") || values.includes("")) {
      return placeholder;
    }
    if (values.length === 1) {
      return options.find(o => o.value === values[0])?.label || placeholder;
    }
    return `${values.length} seleccionados`;
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 text-left rounded-md focus:ring-2 outline-none shadow-sm transition-all flex items-center justify-between min-h-[44px] ${
          theme === "dark" 
            ? "bg-[#1c2642] text-white border border-[#2d3a5c] focus:ring-[#FE5000]/50 focus:border-[#FE5000]" 
            : "bg-white border border-gray-300 focus:ring-[#00205B]/20 focus:border-[#00205B]"
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon && <span className={theme === "dark" ? "text-gray-400 shrink-0" : "text-gray-400 shrink-0"}>{icon}</span>}
          <span className={`truncate font-medium ${
            values.length > 0 && !values.includes("") && !values.includes("Todos")
              ? (theme === "dark" ? "text-white" : "text-gray-900") 
              : "text-gray-500"
          }`}>
            {displaySelected()}
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full mt-1 border rounded-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 ${
          theme === "dark" ? "bg-[#1c2642] border-[#2d3a5c]" : "bg-white border-gray-200"
        }`}>
          {options.length > 10 && (
            <div className={`p-2 border-b ${theme === "dark" ? "border-[#2d3a5c]" : "border-gray-200"}`}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 text-sm rounded outline-none border transition-colors ${
                    theme === "dark" 
                      ? "bg-[#0f172a] border-[#2d3a5c] text-white focus:border-[#FE5000] placeholder-gray-500" 
                      : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#00205B] focus:bg-white placeholder-gray-400"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>
          )}
          <ul className="max-h-60 overflow-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isChecked = isAllOption(option.value) ? isAllSelected : (isAllSelected || values.includes(option.value));
                return (
                  <li
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(option.value);
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                      isChecked
                        ? (theme === "dark" ? "bg-[#FE5000]/10" : "bg-[#00205B]/5") 
                        : (theme === "dark" ? "hover:bg-[#2d3a5c]" : "hover:bg-gray-100")
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isChecked
                        ? (theme === "dark" ? "bg-[#FE5000] border-[#FE5000]" : "bg-[#00205B] border-[#00205B]")
                        : (theme === "dark" ? "border-gray-500" : "border-gray-300")
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </div>
                    <span className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} ${isChecked ? "font-bold" : ""}`}>
                      {option.label}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className={`px-4 py-3 text-sm text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                No se encontraron resultados
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
