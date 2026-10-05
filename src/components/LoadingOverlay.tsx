
import Image from 'next/image';

export default function LoadingOverlay({ fullScreen = true }: { fullScreen?: boolean }) {
  const containerClass = fullScreen 
    ? "fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md"
    : "flex w-full h-64 items-center justify-center";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center">
        {/* Contenedor del Spinner y la Imagen */}
        <div className="relative flex items-center justify-center w-56 h-56 mb-8">
          {/* Anillo giratorio (Spinner) */}
          <svg className="absolute inset-0 w-full h-full animate-[spin_2s_linear_infinite]" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="#E5E7EB" /* Gris claro de fondo */
              strokeWidth="1.5"
            />
            {/* Segmento Naranja */}
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="#FE5000" /* Naranja BNC */
              strokeWidth="3.5"
              strokeDasharray="60 240"
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            {/* Segmento Verde */}
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="#009639" /* Verde BNC */
              strokeWidth="3.5"
              strokeDasharray="40 260"
              strokeDashoffset="-120"
              strokeLinecap="round"
            />
          </svg>

          {/* Imagen central de la tarjeta BNC (Inclinada ligeramente como en tu foto) */}
          <div className="relative w-32 h-auto flex items-center justify-center bg-transparent z-10 -rotate-12">
            <Image
              src="/images/tarjeta-bnc.png"
              alt="Tarjeta BNC"
              width={140}
              height={140}
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
        </div>

        {/* Textos */}
        <h2 className="text-2xl font-black text-[#00205B] tracking-widest uppercase mb-2">
          PAPEL VALOR
        </h2>
        <p className="text-sm text-gray-500 font-bold animate-pulse">
          Cargando módulo, por favor espere...
        </p>
      </div>
    </div>
  );
}
