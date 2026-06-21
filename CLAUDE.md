# CLAUDE.md — Grimório do Mundo

## Visão Geral

Aplicativo offline-first para worldbuilding guiado de campanhas de RPG de mesa (D&D). Funciona como enciclopédia interativa, painel do mestre, rastreador de completude, gerador de ideias e gerenciador de linha do tempo relacional. Suporta múltiplas campanhas independentes com histórico de versões. Roda 100% no cliente, sem backend, sem banco de dados externo, sem autenticação.

---

## Roadmap

### ✅ Fase 1 — MVP React — VALIDADA (18/06/2026)

Stack: React 18 + Vite 5 + TypeScript 5 + CSS Modules. Node 24, npm 11.

- [x] Scaffolding com Vite + React + TypeScript + CSS Modules
- [x] Arquitetura MVC via Context + Reducer (sem Zustand, sem Redux)
- [x] Persistência via localStorage com export/import JSON
- [x] `migrateState` para retrocompatibilidade de dados importados
- [x] Aba: Linha do Tempo — CRUD de eventos, filtros por era/tipo/significância/busca, ordenação por data, modal de edição com 3 sub-abas (Principal / Detalhes / Meta)
- [x] Aba: Configuração — nome e lore do mundo, data atual da campanha, construtor de calendário (padrão 12 meses reais ou calendário fantástico customizado com N meses e dias livres)
- [x] Aba: Estatísticas — score de completude, contadores, barras de progresso por era/tipo/significância, progresso dos prompts por categoria
- [x] Aba: 400 Prompts — 10 categorias temáticas, checkboxes, notas por prompt, sorteador aleatório, filtro pendentes/respondidos/todos, botão converter em evento
- [x] Aba: Ideias de Eventos — 190 ganchos em 10 categorias, navegação lateral por categoria, marcação de usadas, sorteador, botão criar evento
- [x] Aba: Tipos & Dados — gestão de eras (com proteção contra deleção com eventos), tipos customizados, significâncias customizadas, painel de resumo numérico
- [x] UI Dark Fantasy — tema grimório completo com variáveis CSS, scrollbar customizada, tabela responsiva, modal overlay
- [x] `src/vite-env.d.ts` — declaração de tipos para CSS Modules (obrigatório)
- [x] `.npmrc` com `strict-ssl=false` — contorna certificado SSL corporativo/antivírus na instalação de pacotes

**Comando para rodar:**
```bash
npm run dev
# Abre em http://localhost:5173/
```

**Observação de ambiente:** A máquina de desenvolvimento possui antivírus/proxy que intercepta SSL. O `.npmrc` já resolve isso. Se precisar instalar pacotes novos use `npm install <pkg> --strict-ssl=false` ou confie no `.npmrc` existente.

---

### Fase 2 — Polimento & Expansão (EM ANDAMENTO — iniciada 18/06/2026)

#### ✅ Melhorias Visuais & Responsividade (18/06/2026)
- [x] Responsividade total em todas as telas (mobile-first com breakpoints 640px e 720px)
- [x] TabBar: icons-only em telas pequenas (< 640px), scrollbar oculta, tooltip via `title`
- [x] Header: indicador "Salvo às HH:MM" com cor verde, compacto em mobile (oculta nome do mundo e botões viram ícones)
- [x] EventModal: full-screen bottom-sheet em mobile, grid 1-coluna em mobile, transição suave
- [x] Stats: cards 4→2→1 colunas, scoreCard vertical em mobile, painéis empilhados
- [x] EventIdeas: sidebar vira `<select>` dropdown em mobile (< 720px)
- [x] Prompts: ações sempre visíveis em mobile (sem hover-reveal)
- [x] Setup: dateRow wrap, meses responsivos
- [x] TypesData: painéis em 1 coluna em mobile, hover nos itens
- [x] globals.css: variável `--transition`, focus state com glow dourado, `btn:active` com translate, transições suaves
- [x] Atalhos de teclado: `N` = novo evento (fora de campos), `Esc` = fechar modal
- [x] Confirmação visual de salvo: "✓ HH:MM" no header via `savedAt` no Context

#### ✅ Dados & UX (18/06/2026)
- [x] Campo de "Notas do Mestre" por evento — textarea no sub-tab Meta (`masterNotes: string` em `GrimoireEvent`)
- [x] Sistema de tags livres em eventos — `tags: string[]`, TagInput com chips no modal, filtro dropdown na toolbar, busca por tag integrada
- [x] Desfazer última ação (Ctrl+Z) — historyRef até 20 estados no `AppProvider`, botão "↩ Desfazer" visível quando disponível, Ctrl+Z global fora de campos de texto
- [x] Paginação na tabela de eventos — 50 por página, navegação Anterior/Próxima, reset automático ao mudar filtros

#### ✅ Novas Vistas & Busca (18/06/2026)
- [x] Vista de linha do tempo visual — `TimelineVisual` (Gantt horizontal por era), barras coloridas por tipo, tooltip ao hover, toggle ☰/📅 na toolbar; lanes automáticas para eventos sobrepostos; scroll horizontal proporcional ao range de anos
- [x] Busca global unificada — `GlobalSearch` (Ctrl+K + botão no header), busca em Eventos + Prompts + Ideias, navegação ↑↓ Enter Esc, animação de entrada
- [x] Impressão / PDF export — botão 🖨️, `@media print` com tema claro, A4 landscape, oculta UI desnecessária

#### ✅ Elementos Visuais RPG (18/06/2026)
- [x] `globals.css`: `.rune-divider` (divisor ornamental com gradiente), `.scroll-panel` (painel pergaminho com borda dupla), `.rune-title` (glow dourado), `.shimmer-gold` (animação shimmer)
- [x] Tags de era coloridas: `.tag-era-0..4` (sépia, azul, verde, roxo, âmbar)
- [x] Tags de significância com glow: `.tag-major-global`, `.tag-major-region`, `.tag-minor-local`, `.tag-trivial`
- [x] Paletas de cor por tipo no `TimelineVisual`: militar=crimson, arcano=roxo, político=dourado, natural=azul, etc.

#### ✅ Correções de Bugs (18/06/2026)
- [x] **TimelineVisual — cores de tipo**: `getTypeColor` usava `slice(0,2)` para extrair emoji, quebrando com `🗺️` e `🏛️` (que têm variation selector U+FE0F = 3 code units). Corrigido via `DEFAULT_TYPES.indexOf(type)` com lookup por índice em array paralelo de cores
- [x] **TimelineVisual — eventos sobrepostos**: eventos no mesmo ano se empilhavam no mesmo pixel. Implementado algoritmo guloso `assignLanes` (agendamento de intervalos): cada evento é alocado na menor faixa vertical (*lane*) disponível; a altura da linha da era cresce dinamicamente conforme o número de lanes (`LANE_H = 36px` por lane)
- [x] **TimelineVisual — scroll em ranges grandes**: `min-width: 800px` fixo impedia scroll útil em ranges extensos. Agora `minWidth = Math.max(900, range * 4)` — garante densidade mínima de 4px/ano, tornando o scroll horizontal funcional
- [x] **EventIdeas — tipo militar hardcoded**: "Criar Evento" disparava `ADD_EVENT` diretamente com `type: state.customTypes[0] ?? '💥 Militar, guerra'`, forçando tipo militar em todos os eventos criados pela aba. Corrigido: agora abre `EventModal` com `name` e `summary` pré-preenchidos (`defaultValues` prop), permitindo ao usuário escolher tipo, era e datas antes de salvar
- [x] **EventModal — prop `defaultValues`**: adicionada prop opcional `Partial<Omit<GrimoireEvent, 'id'>>` que pré-preenche o formulário ao criar novo evento; usada por EventIdeas

### ✅ Fase 3 — Multi-Mundo & Histórico — CONCLUÍDA (20/06/2026)

#### ✅ Multi-Mundo — Múltiplas Campanhas (18/06/2026)
- [x] `WorldMeta` e `Checkpoint` em `src/types/index.ts`
- [x] `src/store/worldContext.tsx` — `WorldProvider` + `useWorldStore`: lista de mundos, mundo ativo, CRUD, checkpoints
- [x] `src/utils/storage.ts` expandido: `loadWorlds`, `saveWorlds`, `loadWorldState`, `saveWorldState`, `deleteWorldState`, `loadCheckpoints`, `saveCheckpoints`, `addCheckpoint`, `deleteCheckpointById`, `migrateLegacyIfNeeded`
- [x] Migração automática transparente: dados existentes em `grimorio_state_v1` viram o primeiro mundo automaticamente
- [x] `AppProvider` refatorado: recebe `worldId`, carrega e salva estado no key `grimorio_world_{id}_v1`, notifica `WorldProvider` de metadata (`eventCount`, `updatedAt`)
- [x] `WorldSelector` — tela de seleção de campanha: lista de mundos com cards, criar/renomear/deletar/abrir, importar JSON como novo mundo; funciona como landing page (sem mundo ativo) ou overlay (via botão no header)
- [x] `main.tsx` usa `WorldProvider` em vez de `AppProvider` diretamente
- [x] `App.tsx` roteia: sem mundo ativo → `WorldSelector`; com mundo ativo → `AppProvider(key={worldId})` + `AppShell`
- [x] Header: botão "🌍 Mundos" abre `WorldSelector` como overlay; mostra nome do mundo ativo

#### ✅ Histórico de Versões — Checkpoints (18/06/2026)
- [x] `WorldHistory` — painel lateral (slide-in à direita): lista checkpoints com label, data/hora e contagem de eventos
- [x] Salvar checkpoint manual com label livre (ou label automático)
- [x] Restaurar checkpoint: chama `IMPORT_STATE` e fecha o painel
- [x] Deletar checkpoint individual
- [x] Máximo 10 checkpoints por mundo; mais novo fica no topo; excesso remove o mais antigo
- [x] Header: botão "🕐 Histórico" abre `WorldHistory`
- [x] Storage key: `grimorio_history_{worldId}_v1`

#### ✅ SQLite Migration — wa-sqlite (19/06/2026)
- [x] Migrar persistência de localStorage para SQLite (browser: wa-sqlite)
- [x] `src/utils/db.ts` — singleton `initDB()` com MemoryVFS + IDB binary serialization
- [x] `src/utils/storageDB.ts` — funções async de CRUD por entidade (worlds, states, checkpoints)
- [x] `migrateLegacyIfNeededDB()` — singleton que copia localStorage → SQLite na primeira execução
- [x] `AppProvider` refatorado: shell async (loader) + `AppProviderReady` (useReducer)
- [x] `WorldProvider` refatorado: `initDB()` + `migrateLegacyIfNeededDB()` antes de `setDbReady(true)`
- [x] Tela de loading: "Inicializando banco de dados..." (WorldProvider) e "Carregando campanha..." (AppProvider)
- [x] `vite.config.ts`: `optimizeDeps.exclude: ['wa-sqlite']` — WASM incompatível com pre-bundler do Vite

**Problemas resolvidos:**
- **IDBBatchAtomicVFS falhou** — `IDBBatchAtomicVFS` (VFS async com Asyncify) abria o DB mas falhava em `xRead` com `file.block0 undefined`, causando `SQLiteError: unable to open database file`. Substituído por `MemoryVFS` (sync) + serialização manual do binário SQLite no IndexedDB via `persistDB()`.
- **WASM tmpPtr race condition** — React 18 StrictMode executa effects duas vezes (mount → unmount → remount). Ambas chamadas ao `initDB()` chegavam ao `migrateLegacyIfNeededDB()` e `prepare_v2()` simultaneamente. O `prepare_v2()` usa `tmpPtr` (buffer compartilhado) para retornar o ponteiro do statement — duas chamadas concorrentes corrompiam um ao outro, causando `SQLiteError: bad parameter or other API misuse`. **Correção:** todas as operações de DB passam por `_enqueue()` (fila FIFO) em `db.ts`, e `migrateLegacyIfNeededDB()` é singleton.

**Storage keys SQLite (4 tabelas):**
- `worlds` — metadados de cada campanha
- `active_world` — linha única (singleton=1) com world_id ativo
- `world_states` — JSON completo do AppState por campanha
- `checkpoints` — snapshots com label, timestamp, event_count, state_json

**Persistência IDB:**
- `persistDB()` serializa o binário do MemoryVFS para IndexedDB após cada escrita significativa
- `_boot()` lê o binário do IDB e pré-popula `mapNameToFile` do MemoryVFS antes de `open_v2`
- IDB: banco `grimorio-sqlite`, store `db`, key `main`

**Nota:** Os itens "servidor Node.js", "autenticação" e "colaboração GM share-only" foram removidos do escopo — conflitam com o princípio offline-first e foram substituídos pelo design P2P da Fase 5.

### Fase 4 — Funcionalidades Avançadas
- [ ] Mapa interativo (canvas ou SVG) linkado à timeline
- [ ] Árvore genealógica de personagens/facções
- [ ] Sistema de relações entre eventos (causa → efeito visual)
- [ ] Gerador de NPC com traços, motivações e segredos
- [ ] Integração com regras D&D 5e (bestiário, spells, etc.)

---

### ✅ Fase 5 — Camada de Sessão & Transporte P2P — CONCLUÍDA (21/06/2026)

- [x] Instalar `peerjs` e `qrcode` como dependências de produção
- [x] `src/types/session.ts` — tipos: `SessionState`, `PeerInfo`, `CombatState`, `Token`, `AudioState`, `LogEntry`, `SessionMessage` (discriminated union), `InitiativeEntry`, `SessionSnapshot`, `INITIAL_SESSION_STATE`
- [x] `src/net/protocol.ts` — todas as mensagens tipadas: `JOIN_REQUEST`, `JOIN_ACCEPTED`, `JOIN_REJECTED`, `STATE_SYNC`, `PEER_JOINED`, `PEER_LEFT`, `DICE_ROLL`, `PLAYER_INTENT`, `INITIATIVE_UPDATE`, `HP_UPDATE`, `CONDITION_CHANGE`, `AUDIO_CUE`, `TOKEN_MOVE`, `FOG_UPDATE`, `COMBAT_START`, `COMBAT_END`, `TURN_ADVANCE`, `CHAT_MESSAGE`
- [x] `src/net/SessionHost.ts` — classe: gerencia o Peer como host; aceita conexões; mantém lista de peers; valida capacity (rejeita > 6 com `JOIN_REJECTED { reason: 'full' }`); broadcast de `STATE_SYNC`
- [x] `src/net/SessionGuest.ts` — classe: conecta ao host; envia `JOIN_REQUEST`; recebe e despacha `JOIN_ACCEPTED`, `JOIN_REJECTED`, `STATE_SYNC`; callbacks para onAccepted/onRejected/onSync/onMessage/onDisconnect
- [x] `src/net/qr.ts` — `generateShortCode()` (6 chars alfanuméricos = ID PeerJS do host); `buildSessionUrl(code)`; `parseJoinCode()` (lê `?join=` da URL); `generateQRDataUrl(code)` (QR dourado sobre fundo escuro via `qrcode`)
- [x] `src/store/sessionContext.tsx` — `SessionProvider` + `useSessionStore`: `SessionState` em `useReducer` **não persistido no SQLite**; posicionado em `main.tsx` (acima de `WorldProvider`) para que guests possam entrar sem mundo selecionado; cleanup `peer.destroy()` em `useEffect`
- [x] `src/components/Session/SessionLobby/` — **tela do mestre** (host): código curto em destaque + QR code + botão "Copiar Link" + lista de peers + log de sessão + chat; **tela offline**: botão "Abrir Sessão" + formulário de entrada (nome + código, pré-preenchido via URL `?join=`); **tela do convidado** (guest): status de conexão + lista de peers + log + chat
- [x] `src/components/Session/SessionGuestShell/` — shell enxuto para guest: header com status de conexão + aba única "⚔️ Sessão" → `SessionLobby`
- [x] Ramificação de modo em `App.tsx`: `role === 'guest'` e sem mundo → `SessionGuestShell` standalone; `role === 'guest'` com mundo → `SessionGuestShell` dentro de `AppShell`; `role === 'offline'|'host'` → UI completa
- [x] URL `?join=<code>` detectada em `App.tsx` e `SessionLobby`: pré-preenche código no formulário; auto-navega para aba "⚔️ Sessão" quando mundo está ativo
- [x] `src/types/index.ts`: adicionado `'session'` ao `TabId`; `TABS` tem aba "⚔️ Sessão"

**Desvios do design original:**
- `useSessionHost.ts` e `useSessionGuest.ts` não foram criados como hooks separados — a lógica de ciclo de vida (refs + cleanup) vive diretamente em `sessionContext.tsx` (mais coeso, menos indireção)
- `html5-qrcode` (camera QR scan) não instalado — entrada manual de código + link copiável cobrem os casos de uso; câmera pode ser adicionada depois
- `SessionProvider` colocado em `main.tsx` (acima de `WorldProvider`) em vez de dentro de `AppProviderReady` — necessário para suportar guests sem mundo selecionado

**Nota de signaling:** PeerJS usa broker público (`0.peerjs.com`) apenas para o handshake inicial (troca de ICE candidates). Após a conexão, o tráfego é P2P puro sem passar pelo servidor. Funciona em LAN sem internet após o handshake inicial.

**Testes manuais:**
- [x] Dois dispositivos na mesma rede: mestre abre sessão, guest digita código, conexão estabelecida (21/06/2026)
- [x] Troca de `DICE_ROLL` echo via canal P2P — rolador de dados implementado na `SessionLobby` (host e guest); rola localmente, broadcast via PeerJS, aparece no log de todos (21/06/2026)
- [x] Guest entra via URL `?join=<code>` sem mundo ativo (pendente teste manual)

### ✅ Fase 6 — Fichas de Personagem D&D 5e — CONCLUÍDA (21/06/2026)

**Fichas podem ser criadas offline sem sessão ativa. Depende da Fase 5 apenas para sync em tempo real.**

- [x] `src/types/character.ts` — tipos completos: `Character`, `Ability5e` (STR/DEX/CON/INT/WIS/CHA), `Skill5e` (18 perícias), `Attack`, `Spell`, `Condition5e` (15 condições SRD), `ClassResource`, `SpellSlots` (levels 1-9); helpers `abilityMod`, `skillMod`, `savingThrowMod`, `formatMod`, `profBonus`
- [x] Nova tabela SQLite `characters` em `_boot()` de `db.ts`: `id TEXT PK, world_id TEXT, player_name TEXT, data_json TEXT NOT NULL` + índice `idx_characters_world`
- [x] `src/utils/storageDB.ts` — `loadCharactersDB(worldId)`, `upsertCharacterDB(char)`, `deleteCharacterDB(id)` — todas via `dbRun`/`dbQuery` (respeitam `_enqueue()`); `persistDB()` fire-and-forget
- [x] `src/utils/dice.ts` — `rollDice(notation)` aceita `1d20`, `4d6kh3` (keep highest), `1d20+5`; retorna `{ total, rolls, dropped, bonus, breakdown, notation }`; `rollModifier(mod)` helper
- [x] `src/components/Characters/CharacterList/` — lista de fichas do mundo com cards (avatar, nome, classe, nível, HP bar, condições ativas, top-3 atributos); botão "Nova Ficha"; excluir com confirmação
- [x] `src/components/Characters/CharacterSheet/` — editor completo com 6 sub-abas:
  - **Básico**: avatar picker (thumbnails de `grimorio-avatars`), nome, jogador, raça, classe, subclasse, nível (atualiza proficiência automaticamente), background, alinhamento, experiência, inspiração
  - **Combate**: HP atual (com botões ±1/±5/±10), HP máximo, HP temporário, CA, iniciativa, velocidade, proficiência, salvaguardas da morte, 15 condições (chips toggle), nível de exaustão, tabela de ataques (nome/bônus/dano/tipo/alcance) com botão 🎲 por ataque
  - **Perícias**: 6 caixas de atributo (score + modificador clicável para rolar), salvaguardas com proficiência, 18 perícias com prof/expertise checkboxes + modificador calculado + botão 🎲
  - **Magias**: habilidade de conjuração, CD de resistência, bônus de ataque, 9 níveis de espaços (usados/total), lista de magias por nível (preparada, escola, tempo, concentração, ritual)
  - **Recursos**: recursos de classe (nome, current/max com ±, tipo de recarga: curto/longo/amanhecer/outro)
  - **Notas**: personalidade, ideais, laços, fraquezas, aparência, história/backstory, notas do mestre
- [x] Rolador de dados na ficha: strip sempre visível no topo da sheet (input + botão Rolar + resultado com breakdown); modificadores de atributo/perícia/ataque clicáveis disparam roll diretamente
- [x] Persistência: `upsertCharacterDB` fire-and-forget ao salvar cada campo; `persistDB()` após upsert
- [x] Aba `chars` (`🧙 Fichas`) adicionada ao `TabId` + `TABS` em `src/types/index.ts`
- [x] `src/utils/avatarStorage.ts` — galeria de avatares em IndexedDB `grimorio-avatars` (carregada nas Fases anteriores, reutilizada pelo picker do CharacterSheet e pelos cards do CharacterList)

**Arquitetura da aba Fichas:**
```
CharacterList (state: characters[], selectedId, subView)
  ├── subView='chars' + selectedId → CharacterSheet (full-page dentro do tab)
  ├── subView='chars' + !selectedId → grid de CharacterCard
  └── subView='avatars' → AvatarGallery
```

**Navegação:** CharacterList substitui a view pelo CharacterSheet ao clicar num card (sem modal). Back button retorna ao grid. Salva automaticamente a cada edição (fire-and-forget).

**Notas de implementação:**
- `rollDice('4d6kh3')` rola 4d6 e mantém os 3 maiores (para geração de atributos)
- AvatarPicker no TabBasico: popover com grid 3×N dos avatares do IDB; clique seleciona e fecha
- CharacterCard mostra top-3 modificadores (os maiores) para visão rápida no grid
- Condições ativas aparecem como badges vermelhos no card
- Proficiency bonus recalculado automaticamente ao mudar nível (fórmula SRD: `ceil(level/4) + 1`)

### ✅ Fase 7 — Painel do Mestre Ao Vivo — CONCLUÍDA E VERIFICADA (21/06/2026)

**Depende das Fases 5 e 6.**

- [x] `src/components/Session/MasterDashboard/` — layout em 3 painéis: **Peers**, **Iniciativa**, **Log**
- [x] Painel Peers: card por jogador conectado; HP em barra de progresso; CA, condições ativas (badges com `CONDITION_LABELS`); botões inline "⚔️ HP" e "🔮 Cond."; status de conexão (dot verde); fora de combate mostra classe e HP da ficha vinculada
- [x] Aplicar dano/cura: mestre digita valor → `applyHp(entryId, newHp)` → `UPDATE_ENTRY` local + `HP_UPDATE` broadcast → atualiza todos os devices via `onMessage`
- [x] Aplicar condição: grid das 15 condições 5e com toggle → `applyConditions(entryId, conditions[])` → `UPDATE_ENTRY` local + `CONDITION_CHANGE` broadcast
- [x] Rastreador de Iniciativa: "Iniciar Combate" → form configura entries (Nome/Ini/HP/Max/CA) com auto-fill de fichas vinculadas (match por `characterId` ou `playerName`) → `COMBAT_START` broadcast com `InitiativeEntry[]` ordenados por iniciativa decrescente; destaque dourado no combatente ativo; botão "Próximo →" → `TURN_ADVANCE`; banner do turno atual; round counter
- [x] NPCs ad-hoc: "+ NPC" no form de setup e também mid-combat (insert ordenado); vivem apenas em `SessionState.combat`, não persistem no SQLite
- [x] Log de sessão: chat + dice rolls + eventos de sistema; feed com timestamp (HH:MM:SS); entrada de chat do mestre; `LogEntry` com campos opcionais `diceNotation?`, `diceTotal?`, `diceBreakdown?`; histórico até 200 entradas
- [x] Rolador de dados integrado ao Log Panel; 7 botões rápidos (`d4/d6/d8/d10/d12/d20/d100`) + input livre de notação
- [x] Vista do jogador (`GuestConnectedView` em `SessionLobby.tsx`): quando combate ativo, exibe ordem de iniciativa com turno atual destacado; HP como texto (`hp/hpMax`); condições como contagem (`N cond.`); recebe `COMBAT_START`, `TURN_ADVANCE`, `HP_UPDATE`, `CONDITION_CHANGE` via `onMessage` em `sessionContext.tsx` e aplica ao state local
- [x] `sessionContext.tsx` expandido: actions `SET_COMBAT`, `UPDATE_ENTRY`, `ADVANCE_TURN`; funções `startCombat`, `endCombat`, `advanceTurn`, `applyHp`, `applyConditions`; `parseDiceRoll` para sessão (parser simples — suporta `NdX+mod`, não suporta `kh3`/keep-highest)
- [x] `InitiativeEntry` expandido: campos opcionais `peerId?` e `characterId?` para mapear a peers e fichas; `SessionState` tem `myCharacterId: string | null` para tracking futuro de ficha do guest
- [x] `ConnectionBar` compacta no topo: código, link copiável, QR popover, contador de peers (`N/6`), botão encerrar
- [x] Integração com fichas: ao iniciar combate, auto-fill de HP/CA/nome a partir das fichas `Character` do mundo (match por `characterId` ou nome do jogador)

**Desvios do design original:**
- Integração com grimório (botão abrir Timeline com foco em data) não implementada — exige `SET_ACTIVE_TAB` cross-context que complexificaria demais o SessionLobby; fica para Fase 10
- role guard em `masterNotes`/`spoiler` não implementado — o AppState do grimório já não é compartilhado com guests, então o guard é implícito pela arquitetura
- `GuestConnectedView` mostra condições como contagem (`N cond.`) em vez de badges individuais — UI enxuta intencional para guests; badges completos ficam no PeersPanel do mestre
- `SessionGuestShell` agora tem aba de sessão e aba de ficha atribuída; a ficha é exibida como resumo de mesa recebido via `ASSIGN_CHARACTER`
- Dois parsers de dado coexistem: `parseDiceRoll` em `sessionContext.tsx` (sessão, sem `kh3`) e `rollDice` em `src/utils/dice.ts` (fichas, com `4d6kh3`); unificação fica para Fase 10 ou refactor futuro

#### ✅ Fase 7.1 — ciclo Mundo ↔ Fichas ↔ Sessão — CONCLUÍDA (21/06/2026)

- [x] `ASSIGN_CHARACTER` adicionado ao protocolo de sessão
- [x] `SessionSnapshot.assignedCharacters`, `SessionState.assignedCharacters` e `SessionState.myCharacter` adicionados para guests receberem a ficha vinculada
- [x] `SessionHost.assignCharacter()` atualiza `PeerInfo.characterId` no host e sincroniza peers/snapshot
- [x] `sessionContext.tsx` expõe `assignCharacter(peerId, characterId, character)`, aplica atribuições no reducer e sincroniza `myCharacter` no guest
- [x] `MasterDashboard/PeersPanel`: dropdown de ficha em cada peer card; permite vincular/desvincular jogador a uma ficha do mundo ativo
- [x] `SessionGuestShell`: aba `Ficha` adicionada; mostra resumo de HP, CA, iniciativa, velocidade, condições, ataques, recursos e magias preparadas da ficha atribuída
- [x] `endCombat` no painel do mestre grava HP atual e condições de volta em `Character.hpCurrent`/`Character.conditions` via `upsertCharacterDB`
- [x] `HP_UPDATE`, `CONDITION_CHANGE` e `TURN_ADVANCE` atualizam o snapshot do host para late joiners
- [x] Header bloqueia o botão "Mundos" durante sessão ativa com tooltip explicativo
- [x] Build verificado: `npm run build` passou (21/06/2026)

**Desvios da especificação detalhada da Fase 7.1:**
- `UNASSIGN_CHARACTER` não virou mensagem separada; desvincular usa `ASSIGN_CHARACTER` com `characterId: null`
- `CHARACTER_SYNC` e `HP_SYNC` não foram criados como mensagens separadas; HP/condições continuam sincronizados por `HP_UPDATE`/`CONDITION_CHANGE`, e o encerramento do combate persiste no SQLite local do mestre
- A aba `Ficha` do guest usa um resumo read-only dedicado em vez de reaproveitar `CharacterSheet` em `sessionMode`; isso evita expor edição offline e reduz payload/complexidade por enquanto
- `WorldSelector` ainda não recebeu guard interno; o Header já impede abrir o seletor durante sessão ativa

#### ✅ Polimento pré-Fase 8 — Sessão + Avatares (21/06/2026)

- [x] `SessionLobby/GuestConnectedView`: cabeçalho do jogador passa a destacar o avatar da ficha vinculada, nome do jogador, ficha recebida, classe/nível, HP e código da sessão.
- [x] `SessionLobby`: lista de iniciativa do guest mostra retrato/initials dos personagens quando há `assignedCharacters`; lista de jogadores mostra avatar e resumo da ficha atribuída.
- [x] `SessionGuestShell`: header do modo jogador mostra avatar da ficha atribuída; aba `Ficha` usa HP do combate ativo quando existir, barra visual de HP e labels legíveis de condições via `CONDITION_LABELS`.
- [x] `MasterDashboard`: cards de jogadores refinados para avatar, nome, ficha vinculada, HP e CA respirarem melhor no painel do mestre; layout evita truncamento agressivo em nomes longos.
- [x] Validação: `npm run build` passou após o polimento (21/06/2026).

### Fase 8 — Áudio & Ambientação (PENDENTE)

**Depende da Fase 5 para `AUDIO_CUE` broadcast. Funciona offline (só mestre) mesmo sem sessão ativa.**

- [ ] Instalar `howler` como dependência de produção (ver exceção em Convenções de Código)
- [ ] `src/utils/audio.ts` — `AudioManager` singleton sobre Howler: `play(trackId)`, `stop(trackId)`, `loop(trackId, volume)`, `stopAll()`, `setVolume(trackId, vol)`, `crossfade(fromId, toId, durationMs)`
- [ ] Assets de áudio: caminho principal é import via upload → IndexedDB (`grimorio-audio`). `public/audio/` fica vazio por padrão; incluir faixas bundled **somente** se houver arquivos CC0/CC-BY confirmados; o app funciona 100% sem assets pré-carregados
- [ ] `src/components/Session/AudioMixer/` — painel do mestre: lista de faixas com play/pause, slider de volume, loop/one-shot, crossfade entre ambientes; seção separada para SFX
- [ ] Import de áudio: campo de upload; `ArrayBuffer` armazenado no IndexedDB (store `grimorio-audio`); aparece na lista abaixo das faixas bundled
- [ ] `AUDIO_CUE` broadcast: quando mestre clica play/stop, envia cue para guests; **marcado EXPERIMENTAL** — autoplay bloqueado por browsers sem interação prévia; jogadores veem banner "🔊 Clique para habilitar áudio" na primeira conexão
- [ ] `SessionState.audioState`: `{ active: Record<trackId, { playing, volume, loop }> }` — mestre é fonte da verdade; guests sincronizam via `STATE_SYNC`

### Fase 9 — Mapa & Grid de Batalha (PENDENTE)

**Maior bloco de trabalho isolado. Depende das Fases 5 e 6.**

- [ ] Instalar `konva` + `react-konva` como dependências de produção (ver exceção em Convenções de Código)
- [ ] `src/types/map.ts` — tipos: `BattleMap`, `MapToken`, `FogCell`, `GridType` (`'square'|'hex'`), `Measurement`, `TokenColor`
- [ ] `src/components/Session/BattleMap/` — canvas Konva com: grid quadriculado (padrão) ou hexagonal; imagem de fundo; tokens arrastáveis; ruler de medição (clique-arraste mostra distância em pés); destaque animado no token do combatente ativo
- [ ] Import de mapa: upload PNG/JPG/WebP; `ArrayBuffer` no IndexedDB (store `grimorio-maps`); mestre define escala (ex: 1 quadrado = 5 pés = N pixels)
- [ ] Tokens: criados de fichas `Character` (ícone = inicial + cor do jogador) ou NPCs ad-hoc (inicial + vermelho); posições em `SessionState.tokens`
- [ ] Fog of war: mestre revela áreas com click/drag; jogadores veem apenas células reveladas; `FOG_UPDATE` broadcast com `RevealedCell[]`; clipping layer no canvas Konva
- [ ] Sync de tokens: guests movem apenas o próprio token; host move qualquer token; `TOKEN_MOVE` broadcast validado pelo host
- [ ] Múltiplos mapas por sessão: mestre cria/troca mapa ativo; `STATE_SYNC` inclui `activeMapId` + estado completo do mapa
- [ ] Mobile: pinch-zoom + pan no canvas Konva; toolbar de ferramentas colapsável em telas pequenas
- [ ] Nota: `BattleMap` de sessão e mapa interativo do mundo (Fase 4) são componentes distintos; integração (linkar batalha a ponto do mapa-mundo) planejada para Fase 11+

### Fase 10 — Bestiário 5e & Polimento (PENDENTE)

**Depende de todas as fases anteriores. Integração e acabamento.**

- [ ] `src/data/bestiary.ts` — ~50 monstros do SRD 5e com stat blocks: `MonsterStat { name, cr, hp, ac, speed, abilities, attacks, traits, actions, legendaryActions }`; cobertura: goblin, orc, dragão jovem, esqueleto, zumbi, lobo, ogro, troll, vampiro, lich
- [ ] `src/components/Session/Bestiary/` — painel pesquisável por nome/CR/tipo; botão "Adicionar ao combate" cria `NPCEntry` na iniciativa e `MapToken` no mapa ativo
- [ ] Reconexão graciosa: guest que cai (rede) ao reconectar envia `JOIN_REQUEST` com mesmo `characterId`; host detecta reentrada → `JOIN_ACCEPTED` + `STATE_SYNC` completo; guest retoma sem perder progresso visível
- [ ] Sala de espera: antes de `COMBAT_START`, guests ficam num lobby onde veem quem entrou, sua ficha e o log de chat; mestre vê lista de quem está pronto e pode iniciar manualmente
- [ ] Snapshot de combate: ao fim da sessão, mestre salva relatório automático (participantes, HP inicial/final, kills, turnos) → botão "Salvar como Evento" → `ADD_EVENT` com `summary` gerado; ponte entre sessão efêmera e história persistente no grimório
- [ ] `src/components/Session/CombatReport/` — modal de fim de sessão; resumo com dano sofrido/causado; notas do mestre; preview do evento a ser criado na `Timeline`
- [ ] Performance: `STATE_SYNC` envia apenas `SessionSnapshot` (compacto) — **nunca** o `AppState` do grimório inteiro; medir payload e manter < 50 KB
- [ ] Acessibilidade: `aria-label` nos tokens do canvas, descrições de condições, contraste mínimo 4.5:1 nos badges
- [ ] PWA: `manifest.json` + service worker via Vite PWA plugin; cache de áudio e mapas; install-to-homescreen para mobile
- [ ] Testes em rede real: roteiro com 3+ dispositivos (celular + notebook mestre + tablet jogador); cenários: host cai e reconecta, guest entra após combate iniciado, fog of war em mobile, áudio experimental nos guests

---

## Regras de Negócio

### Calendário
- **Calendário Padrão**: 12 meses com nomes reais (Janeiro–Dezembro), dias reais por mês (28/30/31).
- **Calendário Customizado**: usuário define N meses com nome e quantidade de dias cada. Validação mínima: pelo menos 1 mês com pelo menos 1 dia.
- **Data Atual da Campanha** (currentYear/Month/Day): âncora temporal para cálculos de "há X anos", "daqui a Y meses", etc.
- **Dias Absolutos** (`dateToAbsoluteDays`): toda data é convertida em número inteiro de dias desde o dia 1/mês 1/ano 1 para calcular durações entre eventos. Deve respeitar o calendário ativo (padrão ou customizado).

### Eventos
- **ID**: auto-incrementado via `counters.nextEventId`, nunca reutilizado.
- **Era**: obrigatória; deve existir na lista `state.eras`.
- **Data de Início**: ano obrigatório; mês e dia são opcionais.
- **Data de Fim**: completamente opcional. Se ausente, evento é pontual.
- **Duração calculada**: se fim existir, exibir diferença legível. Se não, exibir relação com data atual ("há X anos", "em X anos").
- **Spoiler**: `not` | `minor` | `major` — controla visibilidade para jogadores.
- **Personal**: `not` | `yes` — marca eventos privados do mestre.
- **Significância**: valores padrão são Major / Global, Major / Regional, Minor / Local, Trivial. Editável na aba Tipos & Dados.
- **Tipo**: escolhido entre tipos padrão + customTypes. Formato esperado: emoji + texto (ex: "⚔️ Militar, guerra").

### Prompts
- Cada prompt tem: `id` único (string, ex: "001"), `text`, `done` (boolean), `note` (string livre).
- Prompts são agrupados em categorias.
- Converter prompt em evento: pré-preenche o campo `summary` do novo evento com o texto do prompt.
- Sorteador aleatório: seleciona 1 prompt não concluído aleatoriamente.

### Ideias de Eventos
- 190 ganchos narrativos categorizados.
- Converter em evento: abre `EventModal` com `name` = título da ideia e `summary` = descrição pré-preenchidos via prop `defaultValues`. O usuário escolhe tipo, era e datas antes de salvar.
- Podem ser marcadas como "usadas" (sem deletar do banco).

### Exportação / Importação
- Export: `JSON.stringify(state)` baixado como arquivo `.json` com nome `grimorio-<worldName>-<date>.json`.
- Import: lê o arquivo JSON, chama `migrateState()` para garantir retrocompatibilidade, substitui o state inteiro.
- `migrateState`: sempre adiciona campos faltantes com valores padrão ao importar arquivos de versões antigas.

### Eras
- Sempre pelo menos 1 era deve existir.
- Ao deletar uma era com eventos atrelados: bloquear com aviso, ou oferecer reatribuição.

### Tipos Customizados
- Formato livre, mas recomendado: "emoji + texto".
- Tipos padrão do sistema nunca são deletados; apenas customTypes são gerenciados.

### Sessão Ao Vivo (Mesa Digital)

#### Fichas de Personagem D&D 5e
- `Character` é persistido em tabela SQLite `characters` (document-store: `data_json` = JSON completo da ficha). Ops via `dbRun`/`dbQuery` (respeitam `_enqueue()`).
- HP, condições e slots de magia são campos do `Character` e **são persistidos** entre sessões — refletem o estado real da ficha.
- Estado **de combate** (HP turno-a-turno, posição no grid, NPCs ad-hoc) fica no `SessionState` efêmero — **não persiste** no SQLite.

#### Protocolo de Mensagens
- Todas as mensagens são tipadas via discriminated union `SessionMessage` em `src/net/protocol.ts`.
- Fluxo de rolagem: jogador digita `1d20+5` → `parseDiceRoll()` (sessão) ou `rollDice()` (ficha) no cliente → exibe localmente → envia `DICE_ROLL` via canal P2P → host faz broadcast → aparece no log do painel do mestre.
- Fluxo de dano: mestre digita valor no painel → `applyHp()` → `UPDATE_ENTRY` local + `HP_UPDATE` broadcast → guests aplicam via `onMessage` handler em `sessionContext.tsx`.
- **Dois parsers de dado**: `parseDiceRoll` em `sessionContext.tsx` (sessão/log, suporta `NdX+mod`) e `rollDice` em `src/utils/dice.ts` (fichas, suporta `4d6kh3` keep-highest). A função de sessão é intencionalmente mais simples.

#### Princípio "Host Autoritativo"
- O device do mestre é a **fonte da verdade** do `SessionState`.
- Jogadores enviam **intenções** (`PLAYER_INTENT`): rolar dado, mover token, usar recurso. O host valida (slot disponível, alcance no grid, HP não negativo) e só então faz broadcast do estado resultante.
- Isso evita dessincronia, trapaça acidental e conflitos de estado concorrente.
- O `AppState` do grimório (mundo, eventos, timeline) **permanece single-device no mestre** — guests nunca leem nem escrevem no `AppState`.

#### Política de Áudio
- Áudio de ambiente toca **no device do mestre** por padrão (sempre funciona).
- Áudio nos devices dos jogadores é **EXPERIMENTAL**: autoplay é bloqueado por browsers sem interação prévia. Jogadores devem clicar "Habilitar Áudio" ao entrar na sessão.
- `AUDIO_CUE` broadcast é fire-and-forget — falha silenciosa no guest não interrompe a sessão.
- Faixas bundled ficam em `public/audio/` (< 5 MB total). Import do mestre fica no IndexedDB (`grimorio-audio`).

#### Entrada na Sessão — três caminhos
1. **QR code** — câmera do jogador faz scan no dispositivo do mestre (caminho principal em presencial).
2. **Link copiável** — URL com `hostPeerId` no query string; mestre compartilha via WhatsApp/chat (caminho principal para sessão online).
3. **Código curto de 6 chars** — fallback quando câmera não tem permissão ou QR não renderiza. Derivado do `peerId`, digitado manualmente.
Os três caminhos convergem para o mesmo `JOIN_REQUEST` no protocolo.

#### Capacidade e Limites
- Sessão projetada para **4 a 6 jogadores simultâneos** + mestre. PeerJS degrada com mais de ~10 conexões; o `SessionHost` deve rejeitar `JOIN_REQUEST` além do limite com `JOIN_REJECTED { reason: 'full' }`.

#### Fichas e Permissões de Guest
- O guest pode criar e editar **apenas a própria ficha** (identificada pelo `peerId` ou `characterId`). Acesso à aba `chars` em modo restrito: não vê fichas de outros jogadores.
- Edições do guest são **intenções** (`PLAYER_INTENT { type: 'UPDATE_CHARACTER', ... }`): o host valida (ex: HP não pode ultrapassar `hpMax`) e faz broadcast do estado aceito.
- O mestre pode criar fichas e atribuí-las a qualquer guest; fichas não atribuídas ficam visíveis apenas para o mestre.

#### Modos de UI — Mestre vs Jogador
- O app tem **dois modos** ramificados cedo em `App.tsx` (ou no `SessionProvider`): **modo mestre** (UI completa: grimório, fichas, mixer, mapa, bestário) e **modo jogador** (UI enxuta: ficha própria + mapa + iniciativa + log de dados).
- O modo é determinado pelo `SessionState.role` (`'host'` vs `'guest'`). Ao entrar via QR/link/código, o role é `'guest'` automaticamente; ao abrir sessão, é `'host'`.
- Offline (sem sessão ativa), o app sempre roda em modo mestre.

#### Áudio — Política de Assets
- Caminho principal: mestre importa arquivos via upload → `ArrayBuffer` em IndexedDB (`grimorio-audio`). Não há dependência de assets externos.
- Kit inicial em `public/audio/`: **opcional**, incluído apenas se houver arquivos com licença Creative Commons (CC0/CC-BY). Sem licença livre confirmada, `public/audio/` fica vazio e o app funciona 100% via import.

#### Signaling e Offline-First
- O handshake inicial do WebRTC usa o broker público do PeerJS (`0.peerjs.com`). Requer internet apenas no momento da conexão (~5s). Após conectados, tráfego é P2P puro.
- Em LAN sem internet: o handshake falhará sem acesso ao broker. Solução futura (Fase 11+): rodar `peer-js/server` local na máquina do mestre.
- O link copiável também depende do broker para o handshake; o código curto idem.

---

## Integração Mundo ↔ Fichas ↔ Sessão

Esta seção é o spec de design para a ponte entre os três pilares do app. A Fase 7.1 implementou o núcleo do fluxo; os itens marcados como `CHARACTER_SYNC`, `HP_SYNC`, `PLAYER_INTENT` e `sessionMode` permanecem como design alvo para refactor futuro.

### Os Três Pilares e Seus Donos

| Pilar | Persistência | Owner | Guest acessa? |
|---|---|---|---|
| Mundo (`AppState`) | SQLite `world_states` | `AppProvider` (mestre) | Nunca |
| Fichas (`Character[]`) | SQLite `characters` | `storageDB` (mestre) | Apenas a própria, recebida via `ASSIGN_CHARACTER` |
| Sessão (`SessionState`) | Efêmero — RAM | `SessionProvider` | O que o host faz broadcast |

**Regra central:** mundo e fichas pertencem ao mestre. A sessão é efêmera. As fichas são a **ponte** — nascem no mundo, vivem na sessão e voltam ao mundo com o HP resultado do combate.

---

### Fluxo 1 — Vínculo Peer ↔ Ficha (`ASSIGN_CHARACTER`)

**Pré-requisito:** mestre tem um mundo ativo com fichas cadastradas.

```
[Guest entra na sessão]
  → PeersPanel mostra card sem ficha: "⚠️ Sem ficha vinculada"
  → Dropdown "Ficha" lista Character[] do mundo ativo
  → Mestre seleciona uma ficha
  → host: atualiza PeerInfo.characterId localmente
  → host: envia ASSIGN_CHARACTER { peerId, characterId, character: AssignedCharacter }
  → guest: armazena character em SessionState.myCharacter; seta myCharacterId
  → guest: SessionGuestShell exibe a aba "Ficha"
  → SessionSnapshot passa a incluir assignedCharacters[peerId] para reconnect/late join
```

**Regras:**
- Implementado: o mestre pode remover o vínculo a qualquer momento usando `ASSIGN_CHARACTER` com `characterId: null`
- Implementado: late joiners recebem `assignedCharacters` via snapshot
- Futuro: filtrar fichas já atribuídas e reatribuir automaticamente por `playerName` em reconexão

---

### Fluxo 2 — Ficha do Guest Durante a Sessão

Implementado na Fase 7.1: o guest vê um resumo read-only da ficha atribuída com HP, CA, iniciativa, velocidade, condições, ataques, recursos e magias preparadas.

Design alvo futuro: reaproveitar `CharacterSheet` em **modo sessão**:

| Sub-aba | Guest vê? | Guest edita? |
|---|---|---|
| Básico (raça, classe, atributos) | ✅ read-only | ❌ |
| Combate (HP, CA, condições, ataques) | ✅ | Condições apenas (via PLAYER_INTENT) |
| Perícias (modificadores + roller) | ✅ | ❌ (mas pode rolar) |
| Magias (slots + lista) | ✅ | Usar/recuperar slots (via PLAYER_INTENT) |
| Recursos de classe | ✅ | Usar/recuperar (via PLAYER_INTENT) |
| Notas (backstory, personalidade) | ✅ read-only | ❌ |

**HP do guest:** controlado exclusivamente pelo mestre via `applyHp()` no `PeersPanel`. Guest vê o HP do `InitiativeEntry` (combate ativo) ou `myCharacter.hpCurrent` (fora de combate).

**Edições via PLAYER_INTENT (guest → host → broadcast) — design futuro:**

| Ação do guest | Subtype | Validação do host | Broadcast |
|---|---|---|---|
| Usar slot de magia | `USE_SPELL_SLOT` | slot disponível (used < total) | `CHARACTER_SYNC { patch: { spellSlots } }` |
| Recuperar slot | `RECOVER_SPELL_SLOT` | slot não cheio | `CHARACTER_SYNC { ... }` |
| Marcar/desmarcar condição em si mesmo | `TOGGLE_CONDITION` | sempre aceito | `CONDITION_CHANGE` (existente) |
| Usar recurso de classe | `USE_RESOURCE` | `current > 0` | `CHARACTER_SYNC { patch: { classResources } }` |
| Recuperar recurso | `RECOVER_RESOURCE` | `current < max` | `CHARACTER_SYNC { ... }` |

Rolagem de dados da ficha (atributos, perícias, ataques): `parseDiceRoll()` local + `DICE_ROLL` broadcast — sem validação do host.

---

### Fluxo 3 — Sincronização HP ao Fim do Combate

**Disparador:** mestre clica "Encerrar" no `InitiativeTracker`.

```
[Encerrar chamado]
  → host coleta entries com characterId !== undefined
  → para cada entry com characterId:
      upsertCharacterDB({ ...char, hpCurrent: entry.hp, conditions: entry.conditions })  ← fire-and-forget
  → endCombat()

[Condições ao fim do combate:]
  → condições em InitiativeEntry.conditions são escritas em Character.conditions
```

Design futuro: modal de confirmação com tabela de diferenças e broadcast dedicado `HP_SYNC`.

---

### Fluxo 4 — Mundo Trancado Durante Sessão Ativa

Enquanto `session.role === 'host'` e `session.myPeerId !== null` (sessão aberta):

- Botão "🌍 Mundos" no Header fica desabilitado (`disabled` + cursor `not-allowed`)
- Tooltip: "Encerre a sessão antes de trocar de mundo"
- Implementado: Header bloqueia a abertura do seletor enquanto há sessão ativa
- Futuro: `WorldSelector` overlay também bloqueia troca internamente (botão "Abrir" desabilitado com aviso)
- **Motivo:** trocar de mundo desmonta `AppProvider(key={worldId})`, o que destrói os characters carregados na sessão e dessincronizaria o `PeersPanel`

---

### Fluxo 5 — Sessão → Evento na Timeline (CombatReport)

Ao encerrar a sessão (Fase 10), mestre pode salvar o que aconteceu como evento histórico:

```
[Botão "Salvar na Timeline" no CombatReport]
  → abre EventModal pré-preenchido:
      name:    "Sessão N — [nome do mundo]"
      summary: "Participantes: Aria, Theron, [NPC Goblin]. Rounds: 5. Resultado: vitória."
      era:     era atual (calculada pela data corrente do calendário do mundo)
      tags:    ["@Aria", "@Theron", "combate", "sessão"]
      type:    "⚔️ Militar, guerra" (padrão — mestre pode mudar)
  → ADD_EVENT no AppProvider
  → evento aparece na Timeline com data do mundo
```

**Personagens participantes** são extraídos de `combat.entries` que tiveram `characterId` — aparecem como `@NomePersonagem` nas tags para facilitar busca futura na GlobalSearch.

---

### Protocolo — Mensagens Novas (`src/net/protocol.ts`)

```typescript
// Implementado:
| { type: 'ASSIGN_CHARACTER';    peerId: string; characterId: string | null; character: AssignedCharacter | null }

// Design futuro:
| { type: 'CHARACTER_SYNC';      characterId: string; patch: Partial<Character> }
| { type: 'HP_SYNC';             updates: Array<{ characterId: string; hp: number; hpTemp: number; conditions: string[] }> }
| { type: 'PLAYER_INTENT';       subtype: 'USE_SPELL_SLOT' | 'RECOVER_SPELL_SLOT' | 'TOGGLE_CONDITION' | 'USE_RESOURCE' | 'RECOVER_RESOURCE';
                                  characterId: string; [key: string]: unknown }
```

---

### Types — Mudanças Necessárias (`src/types/session.ts`)

```typescript
// Adicionado a SessionState:
myCharacter: AssignedCharacter | null;   // ficha do guest (recebida via ASSIGN_CHARACTER)

// Adicionado a SessionSnapshot:
assignedCharacters: Record<string, AssignedCharacter>;  // peerId → resumo de ficha
                                                        // garante que late joiners recebam a ficha via STATE_SYNC
```

---

### Roadmap de Implementação — Fase 7.1

Status: concluída em 21/06/2026. O ciclo Mundo ↔ Fichas ↔ Sessão agora cobre vínculo de peer a ficha, entrega de resumo de ficha ao guest, sincronização de snapshot e persistência de HP/condições ao encerrar combate.

- [x] `protocol.ts`: `ASSIGN_CHARACTER`
- [x] `session.ts`: `myCharacter`, `assignedCharacters` em `SessionState` e `SessionSnapshot`
- [x] `sessionContext.tsx`: action/reducer `ASSIGN_CHARACTER`, context `assignCharacter(peerId, characterId, character)` e aplicação de ficha no guest
- [x] `SessionHost.ts`: `assignCharacter()` atualiza `PeerInfo.characterId`
- [x] `MasterDashboard/PeersPanel`: dropdown "Ficha" por peer card
- [x] `MasterDashboard/InitiativeTracker`: encerramento de combate persiste HP/condições nas fichas vinculadas
- [x] `SessionGuestShell`: aba `Ficha` read-only com resumo da ficha atribuída
- [x] `Header`: botão "Mundos" desabilitado durante sessão ativa

Itens intencionalmente adiados para refactor futuro:
- [ ] `CHARACTER_SYNC`/`HP_SYNC` como mensagens dedicadas para ações finas de ficha
- [ ] `CharacterSheet` em `sessionMode`
- [ ] Guard interno no `WorldSelector`

---

## Arquitetura

```
src/
  types/
    index.ts              — Tipos do grimório (WorldMeta, Checkpoint, GrimoireEvent, etc.)
    session.ts            — (Fase 5) SessionState (incl. myCharacterId), PeerInfo, CombatState, Token, AudioState, LogEntry, SessionSnapshot, InitiativeEntry
    character.ts          — (Fase 6) Character, Ability5e, Skill5e, Attack, Spell, Condition5e, etc.
    map.ts                — (Fase 9) BattleMap, MapToken, FogCell, GridType, etc.
  data/
    prompts.ts            — Os 400 prompts de worldbuilding
    eventIdeas.ts         — As 190 ideias de eventos
    defaultState.ts       — Estado inicial da aplicação (createDefaultState)
    bestiary.ts           — (Fase 10) ~50 monstros SRD 5e com stat blocks
  net/                    — Camada de transporte P2P — separada de src/store/
    protocol.ts           — SessionMessage discriminated union (todas as mensagens)
    SessionHost.ts        — Classe host: aceita peers (≤6), valida intenções, broadcast
    SessionGuest.ts       — Classe guest: conecta ao host, envia intenções, aplica sync
    qr.ts                 — generateShortCode, buildSessionUrl, parseJoinCode, generateQRDataUrl
  store/
    worldContext.tsx       — WorldProvider + useWorldStore (multi-mundo, checkpoints)
    context.tsx           — AppProvider(worldId) + useAppStore (estado da campanha ativa)
    reducer.ts            — Reducer com todos os actions
    sessionContext.tsx    — SessionProvider + useSessionStore (SessionState efêmero, PeerJS refs); parseDiceRoll (sessão, sem kh3)
  utils/
    dateUtils.ts          — dateToAbsoluteDays, formatDuration, etc.
    storage.ts            — localStorage multi-mundo (legado, apenas leitura)
    db.ts                 — wa-sqlite singleton + _enqueue() FIFO
    storageDB.ts          — CRUD async por entidade (worlds, states, checkpoints, characters)
    dice.ts               — Parser de notação de dados: rollDice(), rollModifier() (Fase 6)
    avatarStorage.ts      — CRUD de avatares em IndexedDB grimorio-avatars (Fase 6)
    audio.ts              — (Fase 8) AudioManager singleton sobre Howler
  components/
    Header/               — Cabeçalho com nome do mundo, botões de I/O, busca, mundos, histórico
    TabBar/               — Navegação entre abas
    Timeline/             — Tabela de eventos + vista visual Gantt + modal de edição
    GlobalSearch/         — Overlay de busca unificada (Ctrl+K)
    Setup/                — Configuração do mundo e calendário
    Stats/                — Dashboard de completude
    Prompts/              — Os 400 prompts com checkboxes
    EventIdeas/           — As 190 ideias categorizadas
    TypesData/            — Gestão de eras, tipos e significâncias
    WorldSelector/        — Tela de seleção/gestão de campanhas (landing + overlay)
    WorldHistory/         — Painel lateral de checkpoints (histórico de versões)
    Characters/           — Fichas D&D 5e (Fase 6 — implementado)
      AvatarGallery/      — Upload/gestão de avatares (IDB grimorio-avatars)
      CharacterList/      — Grid de cards + navegação para CharacterSheet
      CharacterSheet/     — Editor full-page: 6 sub-abas + rolador de dados
    Session/              — Todos os componentes de sessão ao vivo:
      SessionLobby/       — Host: QR + link + código + peers + log + chat. Guest: form entrada. Offline: botão abrir sessão
      SessionGuestShell/  — Shell enxuto para guests: header status + aba Sessão
      MasterDashboard/    — (Fase 7) Painel do mestre: Peers, Iniciativa, Log
      AudioMixer/         — (Fase 8) Mixer de áudio com faixas bundled + import
      BattleMap/          — (Fase 9) Canvas Konva: grid, tokens, fog of war
      Bestiary/           — (Fase 10) Bestiário 5e pesquisável
      CombatReport/       — (Fase 10) Modal de fim de sessão → salvar como evento na Timeline
  styles/
    globals.css           — Reset, variáveis CSS, estilos base
  App.tsx                 — Root: roteia WorldSelector ou AppShell conforme mundo ativo
  main.tsx                — Entry point com WorldProvider
```

### Padrão de Actions do Reducer

| Action | Payload | Descrição |
|---|---|---|
| SET_ACTIVE_TAB | string | Muda aba ativa |
| UPDATE_SETUP | Partial\<Setup\> | Atualiza configurações do mundo |
| ADD_EVENT | Event (sem id) | Adiciona evento, auto-incrementa ID |
| UPDATE_EVENT | Event | Substitui evento pelo ID |
| DELETE_EVENT | number (id) | Remove evento |
| ADD_ERA | string | Adiciona era |
| DELETE_ERA | string | Remove era (se sem eventos) |
| ADD_CUSTOM_TYPE | string | Adiciona tipo customizado |
| DELETE_CUSTOM_TYPE | string | Remove tipo customizado |
| TOGGLE_PROMPT | string (id) | Toggle done do prompt |
| UPDATE_PROMPT_NOTE | {id, note} | Atualiza nota do prompt |
| TOGGLE_PROMPT_COLLAPSE | string (category) | Expande/colapsa categoria |
| UPDATE_FILTERS | Partial\<UIFilters\> | Atualiza filtros da timeline |
| IMPORT_STATE | AppState | Substitui state completo (usado também pelo undo) |
| MARK_IDEA_USED | number (index) | Marca ideia como usada |

**Undo:** Implementado no `AppProvider` via `historyRef` (não no reducer). Actions rastreadas para undo: ADD_EVENT, UPDATE_EVENT, DELETE_EVENT, ADD/DELETE_ERA, ADD/DELETE_CUSTOM_TYPE, ADD/DELETE_SIGNIFICANCE. Ctrl+Z global + botão na toolbar. Máximo 20 estados.

### Storage (SQLite via wa-sqlite + IDB)

**Tabelas SQLite** (MemoryVFS, persiste binário em IndexedDB `grimorio-sqlite`):

| Tabela | Conteúdo |
|---|---|
| `worlds` | `id, name, created_at, updated_at, event_count` |
| `active_world` | `singleton=1, world_id` (sempre 1 linha) |
| `world_states` | `world_id (PK), state_json` — AppState serializado |
| `checkpoints` | `id, world_id, label, timestamp, event_count, state_json` |

**localStorage (legado, apenas leitura)** — migrado automaticamente para SQLite na primeira abertura:

| Key | Conteúdo |
|---|---|
| `grimorio_worlds_v1` | `WorldMeta[]` |
| `grimorio_active_world_v1` | `string` (world ID) |
| `grimorio_world_{id}_v1` | `AppState` |
| `grimorio_history_{id}_v1` | `Checkpoint[]` |
| `grimorio_state_v1` | *(legado v1)* migrado para multi-mundo antes de ir para SQLite |

### WorldProvider vs AppProvider vs SessionProvider

- **SessionProvider** (mais externo, em `main.tsx`): mantém `SessionState` em `useReducer` **separado e não persistido no SQLite**. Gerencia conexão PeerJS (host ou guest), peers conectados, log de sessão. Colocado acima de `WorldProvider` para que guests possam entrar na sessão sem ter um mundo selecionado.
- **WorldProvider** (em `main.tsx`, dentro de `SessionProvider`): chama `initDB()` + `migrateLegacyIfNeededDB()` antes de render. Gerencia lista de mundos, mundo ativo, checkpoints via funções de `storageDB.ts`. Exibe "Inicializando banco de dados..." até `dbReady=true`.
- **AppProvider** (em `App.tsx`, `key={worldId}`): shell que aguarda `loadWorldStateDB(worldId)` antes de montar `AppProviderReady`. Exibe "Carregando campanha..." durante load. Remonta ao trocar de mundo. Todas as escritas são fire-and-forget via `saveWorldStateDB`.

**Árvore de providers (Fase 5+, implementada):**

```
StrictMode
  SessionProvider        ← WebRTC, SessionState, role (efêmero, não persiste)
    WorldProvider        ← lista de mundos, SQLite init, checkpoints
      App.tsx
        [guest sem mundo] → SessionGuestShell standalone
        [sem mundo ativo] → WorldSelector
        AppProvider(key={worldId})   ← shell async aguarda loadWorldStateDB
          AppProviderReady           ← useReducer(appReducer), undo, save
            AppShell
              role === 'guest'           → SessionGuestShell (UI enxuta)
              role === 'host'|'offline'  → UI completa do mestre
                                              ⏳ Timeline
                                              🏰 Configuração
                                              📊 Estatísticas
                                              💡 Prompts
                                              🎲 Ideias
                                              🔗 Tipos & Dados
                                              ⚔️ Sessão (nova — SessionLobby)
                                              🧙 Fichas (Fase 6)
```

---

## Variáveis CSS (Dark Fantasy)

```css
--bg: #0d0d12
--bg-panel: #13131a
--bg-card: #1a1a24
--bg-hover: #202030
--gold: #c9a84c
--gold-light: #e8c66e
--gold-dark: #8a6d2a
--text: #e0d5c5
--text-muted: #8a7f6f
--text-dim: #5a5048
--accent: #6b3a8a
--accent-light: #8b5aaa
--border: #2a2a3a
--border-gold: #4a3a1a
--red: #8b2a2a
--red-light: #c04040
--green: #2a6b3a
--green-light: #40a050
--blue: #2a4a8b
--shadow: rgba(0,0,0,0.6)
```

---

## Redirecionamentos Importantes

### Ao migrar para Node (Fase 3)
- Substituir `localStorage` calls em `src/utils/storage.ts` por chamadas à API REST.
- O `AppProvider` em `context.tsx` precisará de loading states para fetch assíncrono.
- `migrateState` continua necessária para arquivos importados de versões antigas.

### SQLite (implementado na Fase 3 — 19/06/2026)
- Persistência via wa-sqlite com MemoryVFS. `AppState` é armazenado inteiro como JSON em `world_states.state_json` (abordagem document-store, não relacional). Isso mantém compatibilidade com `migrateState` e export/import existentes.
- Para migrar para modelo relacional: extrair `events`, `prompts`, `eras` para tabelas separadas; usar `counters.nextEventId` via AUTOINCREMENT.
- `migrateState` continua necessária para arquivos importados via JSON (importação manual de backups).
- **CRÍTICO:** Todas as ops de DB devem passar pela fila `_enqueue()` em `db.ts` — wa-sqlite usa `tmpPtr` compartilhado em `prepare_v2`, que corrompe em chamadas concorrentes.

### Multi-Mundo (implementado na Fase 3)
- Multi-mundo está implementado via `WorldProvider` + `AppProvider(key={worldId})`.
- Troca de mundo remonta o `AppProvider`, sem necessidade de actions no reducer.
- Para adicionar `worldId` a entidades (ex: Fase 4 - busca cross-mundo), bastaria ler o `worldId` prop no `AppProvider`.

---

## Convenções de Código

- **Sem comentários óbvios**: apenas WHY não-óbvio.
- **Sem dependências externas além de React/Vite**: offline-first. **EXCEÇÕES CONSCIENTES documentadas abaixo** (apenas para a camada de sessão ao vivo, Fases 5–10):
  - `peerjs` — WebRTC P2P (Fase 5): implementar ICE negotiation + signaling do zero seria inviável em manutenção. PeerJS encapsula isso com broker público; após handshake, é P2P puro.
  - `qrcode` — Geração de QR (Fase 5): UX em mesa presencial depende de scan rápido; URL de texto seria fallback, não opção principal.
  - `html5-qrcode` — Leitura de QR via câmera (Fase 5): `BarcodeDetector` API tem suporte inconsistente em mobile browsers.
  - `howler` — Áudio (Fase 8): Web Audio nativa é suficiente para POC, mas Howler gerencia loops, crossfade e formatos MP3/OGG com muito menos código e bugs.
  - `konva` + `react-konva` — Canvas (Fase 9): Canvas2D nativo não tem hit-testing de layers, pinch-zoom nem arraste fácil; fog of war por clipping layer exige gerenciamento que Konva resolve de forma robusta.
- **CSS Modules**: cada componente tem seu `.module.css`.
- **Tipos estritos**: sem `any`. Validar na borda (import, input do usuário).
- **Reducer puro**: sem side effects. Side effects ficam no `useEffect`/providers.
- **Componentes de apresentação**: não alteram state, apenas leem e disparam actions.
- **`SessionState` é efêmero**: nunca persista estado de combate/iniciativa/peers/tokens no `AppState` do mundo. A única exceção é o snapshot de fim de sessão (Fase 10) que converte dados de combate em `GrimoireEvent` via `ADD_EVENT` — aí sim entra no `AppState`.
- **Todas as ops SQLite via `_enqueue()`**: usar exclusivamente `dbRun`, `dbQuery`, `dbExec` de `db.ts`. Nunca chamar `_sqlite3.exec()` ou `prepare_v2()` diretamente — corrompe o `tmpPtr` compartilhado do wa-sqlite em chamadas concorrentes.
