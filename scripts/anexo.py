import subprocess,re,json,sys
pdf=sys.argv[2] if len(sys.argv)>2 else 'public/edital.pdf'
lines=[]
for p in range(19,23):
    t=subprocess.run(['pdftotext','-f',str(p),'-l',str(p),pdf,'-'],capture_output=True,text=True).stdout
    for ln in t.split('\n'):
        lines.append((p,ln.strip()))
heads={'CG':['Língua Portuguesa','Matemática e Raciocínio Lógico','Legislação Institucional'],
 'CE':['Engenharia de Software','Desenvolvimento de Sistemas','Engenharia de Software Assistida por Inteligência Artificial e Sistemas Agentivos',
 'DevOps, Plataforma de Desenvolvimento e Engenharia de Entrega','Banco de Dados','Inteligência Artificial, Ciência de Dados e Automação',
 'Segurança da Informação','Sistemas Operacionais, Redes e Computação em Nuvem','Governança de Tecnologia da Informação',
 'Legislação Aplicada à Tecnologia da Informação','Língua Inglesa (Leitura Técnica)']}
allh=[h for v in heads.values() for h in v]
# find CE B02 start
start_ce=next(i for i,(p,l) in enumerate(lines) if 'CONHECIMENTOS ESPECÍFICOS PARA O CARGO B02' in l)
start_a01=next(i for i,(p,l) in enumerate(lines) if 'CONHECIMENTOS ESPECÍFICOS PARA O CARGO A01' in l)
out={}
def collect(rng,names,blk):
    idx=[]
    for i in rng:
        p,l=lines[i]
        if l in names and l not in [x[0] for x in idx]: idx.append((l,i))
    for k,(name,i) in enumerate(idx):
        end=idx[k+1][1] if k+1<len(idx) else rng[-1]+1
        seg=[lines[j] for j in range(i+1,end)]
        txt=' '.join(l for p,l in seg if l and not re.fullmatch(r'\d{1,2}',l) and not l.startswith('CONHECIMENTOS') and 'TECNOLOGIA DA INFORMAÇÃO'!=l and 'ADMINISTRATIVO E B02' not in l)
        txt=re.sub(r'\s+',' ',txt).strip()
        pages=sorted(set([lines[i][0]]+[p for p,l in seg if l]))
        out[name]={'bloco':blk,'paginas':pages,'texto':txt}
collect(range(0,start_a01),heads['CG'],'CG')
collect(range(start_ce,len(lines)),heads['CE'],'CE')
for k,v in out.items(): print(k,v['bloco'],v['paginas'],len(v['texto']),v['texto'][:90],'...',v['texto'][-60:])
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)
