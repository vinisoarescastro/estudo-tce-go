import { useState } from 'react';
import type { UsuarioPublico } from '../api';

// Foto de perfil do usuário; sem foto (ou se ela falhar ao carregar), mostra a inicial do nome.
export function Avatar({ usuario, tam = 30, className = '' }: { usuario: UsuarioPublico; tam?: number; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const estilo = { width: tam, height: tam, fontSize: Math.round(tam * 0.42) };
  if (usuario.foto && !falhou) {
    return <img className={`avatar avatar-foto ${className}`} style={estilo} src={`/api/perfil/foto?v=${usuario.foto}`} alt="" width={tam} height={tam} onError={() => setFalhou(true)} />;
  }
  const nome = usuario.nome || usuario.email;
  return <span className={`avatar ${className}`} style={estilo} aria-hidden="true">{nome.slice(0, 1).toUpperCase()}</span>;
}
