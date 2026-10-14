"use client";

import React, { useState, useRef, useEffect } from "react";

export type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  icon?: React.ReactNode;
  theme?: "light" | "dark";
  size?: "sm" | "md";
};

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className = "",
  buttonClassName = "",
  dropdownClassName = "",
  icon,
  theme = "light",
  size = "md",
}: Props) {
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

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSmall = size === "sm";

  return (
    <div
      className={`relative ${className}`}
      ref={ref}
      style={{ zIndex: isOpen ? 60 : 1 }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left outline-none transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer shadow-xs ${
          isSmall
            ? "px-3 py-1.5 min-h-[36px] text-xs font-bold rounded-lg"
            : "px-4 py-2.5 min-h-[44px] text-sm font-semibold rounded-xl"
        } ${
          theme === "dark"
            ? "bg-[#1c2642] text-white border border-[#2d3a5c] focus:ring-2 focus:ring-[#FE5000]/40 focus:border-[#FE5000]"
            : "bg-white border border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-[#00205B]/15 focus:border-[#00205B]"
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
          <span
            className={`truncate ${
              selectedOption && selectedOption.value !== ""
                ? theme === "dark"
                  ? "text-white font-bold"
                  : "text-gray-900 font-bold"
                : "text-gray-400 font-medium"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#00205B]" : ""
          }`}
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
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 mt-1.5 min-w-full w-max max-w-sm border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 ${
            theme === "dark"
              ? "bg-[#1c2642] border-[#2d3a5c] text-white"
              : "bg-white border-gray-200 text-gray-900"
          } ${dropdownClassName}`}
          style={{ zIndex: 100 }}
        >
          {options.length > 8 && (
            <div
              className={`p-2 border-b ${
                theme === "dark"
                  ? "border-[#2d3a5c] bg-[#141b2f]"
                  : "border-gray-100 bg-gray-50/80"
              }`}
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar opción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border transition-colors ${
                    theme === "dark"
                      ? "bg-[#0f172a] border-[#2d3a5c] text-white focus:border-[#FE5000]"
                      : "bg-white border-gray-300 text-gray-900 focus:border-[#00205B] focus:ring-1 focus:ring-[#00205B]"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>
          )}

          <ul className="max-h-60 overflow-y-auto py-1 divide-y divide-gray-50 scroll-smooth">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = value === option.value;
                return (
                  <li
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? theme === "dark"
                          ? "bg-[#FE5000]/20 text-[#FE5000] font-black border-l-4 border-[#FE5000]"
                          : "bg-blue-50 text-[#00205B] font-black border-l-4 border-[#00205B]"
                        : theme === "dark"
                        ? "text-gray-300 hover:bg-[#2d3a5c] border-l-4 border-transparent"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <svg
                        className={`w-3.5 h-3.5 shrink-0 ${
                          theme === "dark" ? "text-[#FE5000]" : "text-[#009639]"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </li>
                );
              })
            ) : (
              <li
                className={`px-4 py-3 text-xs text-center ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                No se encontraron resultados
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
