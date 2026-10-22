import { useApp, seed } from '../store/AppStore';
import { diffDias, fmtDia, isoDia } from '../domain/util';
import { Cabecalho, Icone, LinkEdital, Painel } from '../ui/primitives';

// Dados oficiais do concurso e o edital em PDF, servido pela própria aplicação (só para quem entrou).
export function EditalOficial() {
  const { dados } = useApp();
  const prova = dados.user.config.dataProva;
  const faltam = prova ? diffDias(isoDia(), prova) : null;

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Edital oficial"
        subtitulo={seed.fonte.edital}
        acoes={
          <>
            <a className="btn" href="edital.pdf" download="edital-tce-go-01-2026.pdf"><Icone nome="baixar" tam={15} /> Baixar</a>
            <a className="btn" href="edital.pdf" target="_blank" rel="noreferrer"><Icone nome="externo" tam={15} /> Abrir em nova aba</a>
          </>
        }
      />

      <div className="grade-3-2">
        <Painel titulo="Concurso e cargo B02">
          <dl className="fatos">
            {seed.fatos.map((f) => (
              <div key={f.id}>
                <dt>{f.rotulo}</dt>
                <dd>{f.valor}</dd>
                <dd className="nota">{f.ref} · <LinkEdital pagina={f.pagina}>p. {f.pagina}</LinkEdital></dd>
              </div>
            ))}
          </dl>
        </Painel>
        <Painel titulo="Data da prova" info="Data oficial: 17/01/2027 (Anexo III, item 12). É a data usada na contagem regressiva; altere em Metas e planejamento só se a banca mudar o cronograma.">
          <div className="prova">
            {prova ? (
              <>
                <span className="prova-data">{fmtDia(prova, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="nota">{faltam !== null && faltam >= 0 ? `Faltam ${faltam} dias` : 'A prova já foi realizada'}</span>
              </>
            ) : (
              <span className="nota">Ainda não definida.</span>
            )}
            <a className="btn pq" href="#/config/metas" style={{ justifySelf: 'start', marginTop: 8 }}>Alterar data</a>
          </div>
        </Painel>
      </div>

      <Painel titulo="Documento" semPadding acoes={<span className="nota">Os links “p. N” da plataforma abrem o edital na página citada.</span>}>
        <iframe src="edital.pdf#view=FitH" title="Edital nº 01/2026 em PDF" className="pdf" />
      </Painel>
      <p className="nota">Se o documento não aparecer acima (alguns navegadores de celular não exibem PDF dentro da página), <a href="edital.pdf" target="_blank" rel="noreferrer">abra o edital em uma nova aba</a>.</p>
    </div>
  );
}
