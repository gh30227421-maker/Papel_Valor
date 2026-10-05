import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigir directamente al Dashboard principal (Métricas Operativas)
  redirect('/asignaciones');
}
