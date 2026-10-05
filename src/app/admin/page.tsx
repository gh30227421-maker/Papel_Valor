"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, ShieldCheck, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Perfil = {
  id: string;
  nombre: string;
  rol: "admin" | "usuario" | "invitado";
  created_at: string;
};

export default function AdminUsuarios() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol: 'usuario' });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    cargarPerfiles();
  }, []);

  const cargarPerfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando perfiles:", error.message || error);
      toast.error("Error al cargar perfiles: " + (error.message || JSON.stringify(error)));
    } else {
      setPerfiles(data as Perfil[]);
    }
    setLoading(false);
  };

  const cambiarRol = async (id: string, nuevoRol: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("perfiles")
      .update({ rol: nuevoRol })
      .eq("id", id);

    if (!error) {
      setPerfiles(perfiles.map((p) => (p.id === id ? { ...p, rol: nuevoRol as any } : p)));
      toast.success("Rol actualizado correctamente.");
    } else {
      toast.error("Error al cambiar rol. Verifica tus permisos de admin.");
    }
    setSaving(false);
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al crear el usuario");
      }

      // Éxito: cerrar modal, resetear form y recargar lista
      setShowModal(false);
      setFormData({ nombre: '', email: '', password: '', rol: 'usuario' });
      toast.success("Usuario creado correctamente");
      cargarPerfiles();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <p>Cargando panel de administración...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#00205B] flex items-center">
            <ShieldCheck className="mr-3 text-[#FE5000] w-8 h-8" />
            Control de Usuarios y Roles
          </h1>
          <p className="text-gray-500 mt-2">
            Administra los permisos del equipo operativo de Papel Valor.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-6 py-2.5 bg-[#009639] text-white font-bold rounded-lg shadow hover:bg-[#007a2e] transition-colors flex items-center"
        >
          <Users className="mr-2 w-5 h-5" />
          Crear Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-black text-[#00205B] uppercase tracking-wider">
                Nombre de Usuario
              </th>
              <th className="px-6 py-4 text-left text-xs font-black text-[#00205B] uppercase tracking-wider">
                Rol Asignado
              </th>
              <th className="px-6 py-4 text-left text-xs font-black text-[#00205B] uppercase tracking-wider">
                Fecha de Registro
              </th>
              <th className="px-6 py-4 text-right text-xs font-black text-[#00205B] uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {perfiles.map((perfil) => (
              <tr key={perfil.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#00205B] font-bold">
                      {perfil.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-bold text-gray-900">{perfil.nombre}</div>
                      <div className="text-xs text-gray-500">ID: {perfil.id.substring(0, 8)}...</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                      perfil.rol === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : perfil.rol === "usuario"
                        ? "bg-blue-100 text-[#00205B]"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {perfil.rol.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(perfil.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <select
                    disabled={saving}
                    value={perfil.rol}
                    onChange={(e) => cambiarRol(perfil.id, e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#00205B] focus:border-[#00205B] sm:text-sm rounded-md bg-gray-50 font-semibold"
                  >
                    <option value="admin">Administrador</option>
                    <option value="usuario">Usuario Estándar</option>
                    <option value="invitado">Invitado (Solo Lectura)</option>
                  </select>
                </td>
              </tr>
            ))}
            {perfiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No se encontraron usuarios en la tabla de perfiles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#00205B] px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Registrar Nuevo Usuario</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleCrearUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00205B] outline-none" placeholder="Ej. Juan Pérez" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00205B] outline-none" placeholder="correo@banco.com" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Temporal</label>
                <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00205B] outline-none" placeholder="••••••" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Rol en el Sistema</label>
                <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#00205B] outline-none bg-white">
                  <option value="admin">Administrador (Acceso Total)</option>
                  <option value="usuario">Usuario Estándar (Gestión)</option>
                  <option value="invitado">Invitado (Solo Lectura)</option>
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded border border-red-200">
                  {formError}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                <button type="submit" disabled={formLoading} className="flex-1 px-4 py-2 bg-[#FE5000] text-white font-bold rounded-lg hover:bg-[#e04800] transition disabled:opacity-50">
                  {formLoading ? "Registrando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
