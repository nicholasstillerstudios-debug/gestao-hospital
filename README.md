# Gestão Hospitalar

Sistema desktop (Windows / Linux) **offline** para gestão hospitalar —
internação, leitos, evoluções clínicas, prescrição e farmácia. Funciona
sem internet, com banco SQLite local na própria máquina.

## Recursos

### Hospitalar (em produção)

- **Mapa de leitos** por setor (alas / enfermarias / UTI / obstetrícia /
  isolamento / pediatria / observação) com estado em cores (livre,
  ocupado, higienização, manutenção, bloqueado, reservado).
- **Cadastro de setores e leitos** com tipo (UTI, semiintensiva,
  isolamento, obstétrico, pediátrico, berçário, standard), restrição de
  sexo e observações.
- **Admissão de paciente** em leito (eletiva, urgência, emergência,
  obstétrica, transferência externa) com hipótese diagnóstica e CID-10.
- **Internação** com transferência interna (liberação automática do leito
  de origem para higienização) e alta / óbito / evasão.
- **Evolução clínica diária multiprofissional** (médica, enfermagem,
  fisioterapia, nutrição etc.).
- **Sinais vitais hospitalares** com histórico e gráfico.
- **Prescrição hospitalar com aprazamento** e checagem de medicação
  (MAR — Medication Administration Record).
- **Balanço hídrico** com entradas, saídas e saldo diário.
- **Farmácia hospitalar** com catálogo, lotes, validade, dispensação
  FEFO e alertas de vencimento.
- **Histórico de movimentações** por internação (timeline auditável,
  gravado em transação atômica).

### Plataforma

- Login com papéis (administrador, médico, enfermagem, farmácia,
  recepção).
- Cadastro de pacientes e profissionais (CRM / COREN / outros conselhos).
- Trilha de auditoria para conformidade **LGPD** (anonimização,
  exportação de dados, retenção configurável).
- Exportação manual de backup do banco.
- Atualização automática via GitHub Releases (Windows).

### Roadmap

- [ ] **Pronto-socorro** com classificação de risco hospitalar e fila.
- [ ] **Centro cirúrgico** (mapa, time-out, OPME).
- [ ] **CCIH** (vigilância de IRAS — infecções relacionadas à assistência).
- [ ] Prescrição eletrônica com certificado digital ICP-Brasil.
- [ ] Sincronização multi-PC (servidor central em rede local).

## Stack

- [Electron 39](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) + migrations manuais (SQL puro)
- [electron-builder](https://www.electron.build/) para empacotamento

## Como rodar

```bash
npm install
npm run dev         # inicia em modo desenvolvimento (hot reload)
npm test            # vitest
npm run typecheck   # node + web
npm run lint
npm run build:win   # gera instalador .exe (NSIS) em dist/
```

### Login padrão

- **Usuário**: `admin`
- **Senha**: `admin123`

Na primeira entrada, o sistema exige a troca da senha.

## Estrutura

```
src/
  main/      # processo principal Electron (Node) — IPC, repositórios, db, migrations
  preload/   # bridge segura main <-> renderer (contextBridge)
  renderer/  # SPA React (UI)
  shared/    # tipos e utilitários compartilhados entre main/renderer
```

## Banco de dados

O banco SQLite fica em `app.getPath('userData')`:

- **Windows**: `%APPDATA%\Gestão Hospitalar\gestao-hospital.db`
- **Linux**: `~/.config/Gestão Hospitalar/gestao-hospital.db`

Para apontar para outro caminho, defina a variável de ambiente
`GESTAO_HOSPITAL_DB_PATH=/caminho/para.db` antes de iniciar a app.

## Atualização automática

A versão empacotada (Windows) checa por novas versões a cada 60 min
contra as **GitHub Releases** deste repositório (via `electron-updater`).
Quando há uma nova versão, a app baixa o instalador em segundo plano e
mostra um banner "Reiniciar agora" no rodapé. Se o usuário ignorar, a
atualização é aplicada no próximo fechamento natural.

Para publicar uma nova versão:

```bash
npm version patch   # ou: minor / major
git push --follow-tags
```

O workflow `.github/workflows/release.yml` dispara em `v*`, builda no
Windows e publica o `.exe` + `latest.yml` na Release.

## Licença

MIT
