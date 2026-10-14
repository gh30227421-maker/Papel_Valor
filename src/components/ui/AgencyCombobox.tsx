"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

export interface AgencyOption {
  codigo: string;
  nombre: string;
  region?: string;
  zona?: string;
}

interface Props {
  agencies: AgencyOption[];
  value: string;
  onChange: (codigo: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Función auxiliar para normalizar texto (sin acentos, minúsculas)
function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function AgencyCombobox({
  agencies,
  value,
  onChange,
  placeholder = "Buscar o seleccionar agencia por código, nombre o región...",
  className = "",
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Buscar agencia seleccionada
  const selectedAgency = useMemo(() => {
    return agencies.find((a) => a.codigo === value);
  }, [agencies, value]);

  // Filtrado reactivo e inteligente
  const filteredAgencies = useMemo(() => {
    if (!search.trim()) return agencies;
    const term = normalizeText(search);

    return agencies.filter((ag) => {
      const codeNorm = normalizeText(ag.codigo);
      const nameNorm = normalizeText(ag.nombre);
      const regNorm = normalizeText(ag.region || "");
      const zonaNorm = normalizeText(ag.zona || "");

      return (
        codeNorm.includes(term) ||
        nameNorm.includes(term) ||
        regNorm.includes(term) ||
        zonaNorm.includes(term)
      );
    });
  }, [agencies, search]);

  // Manejar click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autofoco y reseteo al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Scroll automático hacia el elemento resaltado
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Manejo del teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredAgencies.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredAgencies.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredAgencies[highlightedIndex]) {
          onChange(filteredAgencies[highlightedIndex].codigo);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (codigo: string) => {
    onChange(codigo);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ zIndex: isOpen ? 60 : 1 }}
      onKeyDown={handleKeyDown}
    >
      {/* Botón Trigger / Display */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] px-3.5 py-2 bg-white text-left rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 shadow-xs group ${
          isOpen
            ? "border-[#00205B] ring-2 ring-[#00205B]/15 bg-white"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50/50"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-100" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
          {/* Icono de Agencia / Banco */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              selectedAgency
                ? "bg-[#00205B] text-white"
                : "bg-gray-100 text-gray-500 group-hover:text-gray-700"
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>

          {selectedAgency ? (
            <div className="flex items-center gap-2 truncate">
              {/* Badge de Código */}
              <span className="font-mono text-xs font-black text-[#00205B] bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded shadow-2xs shrink-0">
                {selectedAgency.codigo}
              </span>
              {/* Nombre de Agencia */}
              <span className="font-bold text-gray-900 text-xs truncate">
                {selectedAgency.nombre}
              </span>
              {/* Badge de Región */}
              {selectedAgency.region && (
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase shrink-0 hidden sm:inline-block border border-gray-200">
                  {selectedAgency.region}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 font-medium truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Acciones a la derecha: Botón limpiar + Flecha */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedAgency && !disabled && (
            <span
              onClick={handleClear}
              role="button"
              tabIndex={0}
              title="Quitar selección"
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
          )}

          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#00205B]" : ""
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* Menú Desplegable Moderno */}
      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
          style={{ zIndex: 100 }}
        >
          {/* Header con Buscador */}
          <div className="p-2.5 bg-gray-50/80 border-b border-gray-200">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código (#47), nombre o región..."
                className="w-full pl-9 pr-8 py-2 bg-white text-xs font-semibold text-gray-900 border border-gray-300 rounded-lg outline-none focus:border-[#00205B] focus:ring-2 focus:ring-[#00205B]/10 placeholder-gray-400 shadow-2xs"
                onClick={(e) => e.stopPropagation()}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Contador de resultados */}
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              <span>Agencias BNC</span>
              <span className="text-[#00205B] bg-blue-50 px-2 py-0.5 rounded font-mono font-black">
                {filteredAgencies.length} de {agencies.length}
              </span>
            </div>
          </div>

          {/* Lista de Opciones */}
          <ul
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-gray-100 scroll-smooth"
          >
            {filteredAgencies.length > 0 ? (
              filteredAgencies.map((agency, index) => {
                const isSelected = agency.codigo === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={agency.codigo}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(agency.codigo)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? "bg-blue-50/80 text-[#00205B] border-l-4 border-[#00205B]"
                        : isHighlighted
                        ? "bg-gray-50 border-l-4 border-gray-300"
                        : "hover:bg-gray-50/60 border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Código de la agencia */}
                      <span
                        className={`font-mono text-xs font-black px-2 py-0.5 rounded shadow-2xs shrink-0 ${
                          isSelected
                            ? "bg-[#00205B] text-white"
                            : "bg-gray-100 text-[#00205B] border border-gray-200"
                        }`}
                      >
                        {agency.codigo}
                      </span>

                      {/* Nombre y detalles */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-black truncate leading-tight ${
                            isSelected ? "text-[#00205B]" : "text-gray-900"
                          }`}
                        >
                          {agency.nombre}
                        </p>
                        {(agency.region || agency.zona) && (
                          <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                            {agency.region} {agency.zona ? `• ${agency.zona}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Badge o Check de Selección */}
                    <div className="flex items-center gap-2 shrink-0">
                      {agency.region && (
                        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase hidden md:inline-block">
                          {agency.region}
                        </span>
                      )}

                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-[#009639] text-white flex items-center justify-center shadow-xs">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                      ) : isHighlighted ? (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider hidden sm:inline">
                          Enter ↵
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-xs font-bold text-gray-700">
                  No se encontraron agencias
                </p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
                  No hay coincidencias para &quot;{search}&quot;. Prueba buscando
                  por número de código o nombre de ciudad.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
