"use client";

import React, { useState, useEffect } from "react";
import DashboardStats from "@/components/DashboardStats";
import DashboardStock from "@/components/DashboardStock";
import { useRouter, useSearchParams } from "next/navigation";

export default function AsignacionesModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "asignaciones" | "stock";
  
  const [activeTab, setActiveTab] = useState<"asignaciones" | "stock">(
    tabFromUrl === "stock" ? "stock" : "asignaciones"
  );

  // Sync state with URL when URL changes (e.g. back button)
  useEffect(() => {
    if (tabFromUrl === "stock" || tabFromUrl === "asignaciones") {
      setActiveTab(tabFromUrl);
    } else {
      setActiveTab("asignaciones");
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: "asignaciones" | "stock") => {
    setActiveTab(tab);
    router.push(`/asignaciones?tab=${tab}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7FA] flex flex-col font-sans">
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        
        {/* Module Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#0B132B] tracking-tight flex items-center">
              {activeTab === "asignaciones" ? "Asignaciones BNC Mastercard Debit" : "INVENTARIO PAPEL VALOR BNC MASTERCARD DEBIT"}
              <svg className="w-12 h-auto ml-4" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#EB001B" />
                <circle cx="22" cy="10" r="10" fill="#F79E1B" />
                <path d="M16 18c2.2-1.7 3.6-4.4 3.6-7.4 0-3-.1-3.6-2.6-6-2.5 2.4-2.6 3-2.6 6 0 3 1.4 5.7 3.6 7.4z" fill="#FF5F00" />
              </svg>
            </h1>
            <p className="text-gray-500 mt-2 max-w-2xl text-sm leading-relaxed">
              {activeTab === "asignaciones" 
                ? "Gestión de asignaciones y control de inventario de tarjetas físicas (TDD)."
                : "Control predictivo y gestión de stock a nivel nacional, regional y por zonas."}
            </p>
          </div>
          
          {/* Custom Pill Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-full border border-gray-200">
            <button
              onClick={() => handleTabChange("asignaciones")}
              className={`py-2 px-6 text-xs font-bold rounded-full transition-all ${
                activeTab === "asignaciones"
                  ? "bg-white text-[#0B132B] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Módulo de Asignaciones
            </button>
            <button
              onClick={() => handleTabChange("stock")}
              className={`py-2 px-6 text-xs font-bold rounded-full transition-all ${
                activeTab === "stock"
                  ? "bg-white text-[#0B132B] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Módulo de Stock
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        {activeTab === "asignaciones" ? <DashboardStats /> : <DashboardStock />}
        
      </main>
    </div>
  );
}
