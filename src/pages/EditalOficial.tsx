import { useApp, seed } from '../store/AppStore';
import { diffDias, fmtDia, isoDia } from '../domain/util';
import { Cabecalho, Icone, LinkEdital, Painel } from '../ui/primitives';
import { concursoDe } from '../domain/concursos';

// Dados oficiais do concurso e o edital em PDF, servido pela própria aplicação (só para quem entrou).
export function EditalOficial() {
  const { dados } = useApp();
  const prova = dados.user.config.dataProva;
  const faltam = prova ? diffDias(isoDia(), prova) : null;
  const c = concursoDe(seed);
  const oficial = seed.cargo?.dataProva;

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Edital oficial"
        subtitulo={seed.fonte.edital}
        acoes={
          <>
            <a className="btn" href={c.pdf} download={c.arquivoPdf}><Icone nome="baixar" tam={15} /> Baixar</a>
            <a className="btn" href={c.pdf} target="_blank" rel="noreferrer"><Icone nome="externo" tam={15} /> Abrir em nova aba</a>
          </>
        }
      />

      <div className="grade-3-2">
        <Painel titulo={`Concurso e cargo ${seed.cargo?.codigo ?? ''}`}>
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
        <Painel titulo="Data da prova" info={`Data oficial: ${oficial ? fmtDia(oficial) : 'não informada'} (${c.dataProvaRef}). É a data usada na contagem regressiva; altere em Metas e planejamento só se a banca mudar o cronograma.`}>
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
        <iframe src={`${c.pdf}#view=FitH`} title={`${c.edital} em PDF`} className="pdf" />
      </Painel>
      <p className="nota">Se o documento não aparecer acima (alguns navegadores de celular não exibem PDF dentro da página), <a href={c.pdf} target="_blank" rel="noreferrer">abra o edital em uma nova aba</a>.</p>
    </div>
  );
}
