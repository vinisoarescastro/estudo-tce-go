import { useApp } from '../../store/AppStore';
import type { Preferencias } from '../../api';
import { Cabecalho, Painel } from '../../ui/primitives';

const TEMAS: { valor: Preferencias['tema']; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

// Preferências visuais, salvas na conta (valem em qualquer dispositivo).
export function ConfigPersonalizacao() {
  const { prefs, definirPrefs } = useApp();
  return (
    <div className="pagina pagina-estreita">
      <Cabecalho sobre="Configurações" titulo="Personalização" subtitulo="Aparência da plataforma. Fica salva na sua conta." />
      <Painel>
        <div className="config">
          <div className="config-secao">
            <div className="config-desc">
              <h2 id="tema-t">Tema</h2>
              <p>“Automático” segue o tema claro ou escuro do sistema.</p>
            </div>
            <div className="temas" role="radiogroup" aria-labelledby="tema-t">
              {TEMAS.map((t) => (
                <label key={t.valor} className={`tema ${prefs.tema === t.valor ? 'on' : ''}`}>
                  <input type="radio" name="tema" value={t.valor} checked={prefs.tema === t.valor} onChange={() => definirPrefs({ tema: t.valor })} />
                  <span className={`amostra amostra-${t.valor}`} aria-hidden="true"><i /><i /><i /></span>
                  {t.rotulo}
                </label>
              ))}
            </div>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Menu lateral</h2>
              <p>No celular, o menu sempre abre por cima da página.</p>
            </div>
            <label className="linha-switch">
              <span>
                <b>Menu recolhido</b>
                <span className="campo-ajuda" style={{ display: 'block' }}>Mostra só os ícones, ampliando a área de conteúdo.</span>
              </span>
              <span className="interruptor">
                <input type="checkbox" checked={prefs.menuRecolhido} onChange={(e) => definirPrefs({ menuRecolhido: e.target.checked })} />
              </span>
            </label>
          </div>
        </div>
      </Painel>
    </div>
  );
}
