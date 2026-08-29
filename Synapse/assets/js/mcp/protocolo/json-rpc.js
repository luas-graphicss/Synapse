'use strict';
let MCP_INSTRUCTIONS =
	'Servidor MCP do Synapse Live Preview: editor de projetos web (.zip) com preview ao vivo ' +
	'no navegador do usuário. Toda alteração de arquivo atualiza o preview em tempo real. ' +
	'Fluxo recomendado: project_status -> list_files -> read_file/search -> ' +
	'edit_file/write_file. Use create_project para começar um projeto do zero e console_logs ' +
	'para depurar erros do preview. Caminhos são relativos, sem barra inicial (ex.: ' +
	'src/app.js). Terminal: run_command executa comandos reais (npm, node, builds) na pasta ' +
	'espelhada do projeto no PC do usuário; se não terminar a tempo, acompanhe com ' +
	'command_output usando o proc_id (stop_command encerra). Arquivos gerados voltam ' +
	'automaticamente ao editor e ao preview. Requer que o usuário marque a permissão do ' +
	'terminal no menu MCP. Assets: use add_asset_from_url para baixar arquivos binarios da ' +
	'web (glb, png, mp4, ogg etc.) direto para o projeto, ou add_asset_base64 para arquivos ' +
	'pequenos; o preview usa os assets pelo caminho relativo automaticamente. MULTIPROJETO: ' +
	'todas as ferramentas aceitam o parâmetro project (nome ou id) e são aplicadas nesse ' +
	'projeto mesmo que ele não esteja ativo na tela — vários agentes podem trabalhar ao ' +
	'mesmo tempo, cada um em um projeto. Nesse cenário SEMPRE informe project em TODAS as ' +
	'chamadas e NÃO use set_active_project (isso troca a tela do usuário e atrapalha os ' +
	'outros agentes). create_project não troca mais o projeto ativo por padrão (use ' +
	'activate=true se quiser ativar na tela). Projetos que existem na pasta do relay mas não ' +
	'estão abertos no editor: liste com list_disk_projects e abra com ' +
	'open_project_from_disk. VISAO: você consegue VER e TESTAR o que criou — ' +
	'screenshot_preview retorna uma imagem real do PREVIEW INTEIRO (a tela toda: DOM, HUD, ' +
	'menus e o conteudo dos canvas embutido; mode="canvas" captura so o canvas do jogo); ' +
	'query_dom lê o DOM renderizado; interact simula cliques, digitação e teclas (hold_ms ' +
	'segura teclas em jogos; screenshot_after=true já devolve a imagem do resultado); ' +
	'eval_js executa JS no preview e retorna o estado do app. Use screenshot_preview após ' +
	'mudanças visuais importantes para conferir o resultado. AUTONOMIA: além dessas, use ' +
	'ui_map (mapa dos elementos interativos com seletor e coordenadas — o “mapa de cliques”),' +
	' wait_for (espera ativa até um seletor aparecer/sumir ou um JS ficar truthy — use no ' +
	'lugar de waits cegos), assert_state (PASS/FAIL de uma expressão JS com retry e ' +
	'screenshot automático na falha), record_frames (sequência de 2-8 frames para VER ' +
	'animação/movimento), screenshot_burst (rajada de N quadros devolvida como UMA imagem ' +
	'filmstrip rotulada com +ms e com a % de pixels alterados entre quadros — a melhor forma ' +
	'de ver se a animação está fluida, se algo pisca/treme ou se congelou), perf_stats (FPS ' +
	'médio/mínimo, frame time, travadas, long tasks e memória, com veredito — fluidez em ' +
	'números; meça com o projeto ativo para timing real), audio_status (audição: telemetria ' +
	'de WebAudio e das mídias audio/video — o que tocou e quando, volume RMS/pico real, ' +
	'fontes disparadas, erros de mídia e autoplay bloqueado; útil após interact para ' +
	'confirmar que a ação tem som) e run_scenario (teste completo em 1 chamada: passos ' +
	'interact/wait_for/assert com relatório e screenshot — a forma mais eficiente de testar ' +
	'sem humano). RESPONSIVIDADE: set_viewport muda o tamanho do preview (presets ' +
	'celular/tablet/notebook/desktop, width/height exatos, dpr emulado, orientation ' +
	'portrait/landscape, touch) e PERSISTE para as próximas ferramentas de visão; com ' +
	'screenshot_after=true você já VÊ o layout naquele tamanho. Teste os breakpoints antes ' +
	'de entregar (celular 390x844 @3x, tablet 820x1180, desktop 1920x1080) e volte ao normal ' +
	'com preset "padrao". REDE E ESTADO: network_log mostra as requisições do preview (fetch,' +
	' XHR e recursos que falharam ao carregar — status, tempo e pendentes; only_errors=true ' +
	'filtra só problemas; clear=true zera o registro) — se uma imagem/API não carrega, é ' +
	'aqui que você descobre. reset_state zera localStorage, sessionStorage, IndexedDB e ' +
	'caches do app (cookies opcionais) e recarrega o preview — teste como um usuário novo, ' +
	'sem resíduo de sessões anteriores. INPUT COMPLETO no interact: chord (segurar W+Shift e ' +
	'apertar Espaço junto — acordes de teclas), look (mira relativa dx/dy dividida em vários ' +
	'movementX/Y — o pointer lock é EMULADO automaticamente quando o jogo chama ' +
	'requestPointerLock, e pointer_lock/pointer_unlock forçam o estado — FPS e câmeras ' +
	'orbitais testáveis), drag/touch_drag com path=[[x,y],...] (arrasto com trajetória — ' +
	'peças, sliders, joystick virtual), tap e pinch (toque e pinça de zoom para jogos mobile)' +
	', wheel (scroll/zoom), keydown/keyup (segurar teclas), move com dx/dy e gamepad virtual ' +
	'(buttons/axes; hold_ms solta sozinho). As ferramentas de visão funcionam TAMBÉM com ' +
	'projeto NÃO ativo: o editor monta um preview headless invisível em segundo plano ' +
	'(1280x720 por padrão; set_viewport muda o tamanho) (vários agentes podem ver/testar ' +
	'projetos diferentes em paralelo). Atenção: em headless o navegador pode reduzir o ' +
	'requestAnimationFrame (animações/jogos mais lentos); para timing preciso, ative o ' +
	'projeto na tela. VERIFICACAO: toda gravação (create_file, write_file, edit_file) já ' +
	'valida a sintaxe automaticamente e o resultado avisa se algo quebrou (o arquivo é salvo ' +
	'mesmo assim — corrija imediatamente antes de continuar). check_syntax valida um arquivo ' +
	'ou o projeto inteiro sem executar nada e funciona em qualquer projeto, ativo ou não. ' +
	'wait_for_errors faz um smoke test: recompila o preview, observa alguns segundos e ' +
	'devolve os erros de runtime (requer projeto ativo). VERSIONAMENTO: cada gravação guarda ' +
	'automaticamente a versão anterior do arquivo — use list_versions, read_version, ' +
	'diff_file (diff unificado) e restore_version para inspecionar/desfazer mudanças em 1 ' +
	'arquivo; write_file/edit_file já retornam o delta de linhas. snapshot_project congela o ' +
	'projeto inteiro (rotule marcos com label, ex.: antes do refactor); list_snapshots, ' +
	'diff_snapshot (resumo do que mudou ou diff de 1 arquivo) e restore_snapshot (reverte ' +
	'tudo ou 1 arquivo, criando snapshot de segurança antes). delete também cria snapshot ' +
	'automático. Crie um snapshot antes de mudanças grandes. COORDENACAO: com vários agentes ' +
	'em paralelo, identifique-se passando o MESMO nome no parâmetro agent em TODAS as ' +
	'chamadas (ex.: agent="agente-jogo") — ele identifica você nos locks, no feed de ' +
	'atividade e nas mensagens. claim_project reivindica um projeto para você: gravações de ' +
	'outros agentes ficam bloqueadas até o claim expirar ou você liberar com release_project ' +
	'(suas gravações renovam o prazo). list_claims mostra quem está em qual projeto; ' +
	'agent_activity mostra o que os outros agentes fizeram recentemente; ' +
	'post_message/read_messages trocam recados entre agentes (ex.: pedir para liberar um ' +
	'projeto ou avisar que terminou). Fluxo recomendado em paralelo: list_claims -> ' +
	'claim_project no seu projeto -> trabalhe -> release_project ao terminar. Use force=true ' +
	'apenas se tiver certeza de que o outro agente abandonou o trabalho. EFICIENCIA: ' +
	'minimize idas e voltas — edit_file aceita edits=[{old_str,new_str},...] para várias ' +
	'mudanças no MESMO arquivo em 1 chamada (atômico); write_files grava vários arquivos de ' +
	'uma vez (ideal para criar um projeto inteiro); read_files lê vários arquivos de uma vez;' +
	' outline devolve o mapa de símbolos (funções/classes/headings) com números de linha ' +
	'para você ler só o trecho certo com read_file start_line/end_line. Fluxo eficiente: ' +
	'outline -> read_file (trecho) -> edit_file em lote. DEVSERVER: para projetos com build ' +
	'real (Vite, React, Next etc.), use start_dev_server (padrao: npm run dev; instale ' +
	'dependencias antes com run_command npm install) — o relay vira proxy e o preview mostra ' +
	'o dev server DE VERDADE, com hot-reload; screenshot_preview, query_dom, interact e ' +
	'eval_js continuam funcionando. Gravacoes sao sincronizadas automaticamente para o ' +
	'disco. Se a porta nao for detectada na saida, chame dev_server_status. Encerre com ' +
	'stop_dev_server. Requer terminal e relay v9+. ENTREGA: export_zip gera e baixa o .zip ' +
	'no browser (sem relay, sempre disponivel); deploy_static publica os arquivos como site ' +
	'estatico servido pelo relay (URL /deploy/nome/ — ideal para HTML/CSS/JS puros) — ' +
	'undeploy_static encerra. SEGURANCA: o usuario pode definir uma allowlist de prefixos no ' +
	'menu MCP (campo Comandos permitidos) — quando preenchida, comandos que NAO comecam com ' +
	'um dos prefixos sao bloqueados. Vazio = todos os comandos permitidos. Exemplo: npm, ' +
	'node, git. ESTUDIO 3D: menu interno so para agentes gerenciarem modelos 3D com nocao ' +
	'real de escala/espaco. model3d_list lista os modelos (.glb .gltf .obj .stl .fbx); ' +
	'model3d_inspect devolve UMA imagem (ficha tecnica) com o modelo em 7 vistas ' +
	'(frente/tras/esquerda/direita/topo/baixo/perspectiva), reguas exatas nas 4 bordas de ' +
	'cada vista na unidade escolhida (m, cm, mm, stud, ft, in; stud padrao 0,28 m, ' +
	'configuravel com stud_m), grade no chao e o pivot marcado com gizmo XYZ, alem das ' +
	'medidas exatas em texto. model3d_set_pivot move o pivot (presets: centro, base-centro, ' +
	'topo-centro, dobradica-esquerda/direita/topo para portas, cantos, ou coordenadas ' +
	'absolutas/normalizadas/delta) e ja devolve a imagem atualizada para validar ' +
	'visualmente. model3d_transform rotaciona/escala, incluindo fit (ex.: altura exata de 2,' +
	'10 m). model3d_compare compara ate 4 modelos lado a lado na MESMA escala com silhueta ' +
	'humana de 1,75 m. model3d_apply grava (bake) pivot/rotacao/escala no arquivo real ' +
	'(padrao: gera nome.pivot.ext; overwrite=true substitui; snapshot automatico antes). ' +
	'model3d_convert converte FBX em GLB via terminal do relay. O estado por modelo fica em ' +
	'aurora.3d.json dentro do projeto. Fluxo tipico: model3d_list -> model3d_inspect ' +
	'(medidas) -> model3d_set_pivot (ex.: dobradica-esquerda) -> validar na imagem -> ' +
	'model3d_apply -> usar no jogo com escala e pivot corretos. EQUIPES DE AGENTES: quando o ' +
	'usuario cria Equipes, cada arquivo ou pasta passa a ter DONO e so a equipe dona pode ' +
	'altera-lo. Antes de qualquer gravacao: informe SEMPRE agent="seu-nome" e entre na sua ' +
	'equipe com team_join (o usuario dira o nome, ex.: "entre na equipe Fisica e se registre ' +
	'ali"). Chamada sem agent, ou agente sem equipe, NAO consegue alterar nada - ler ' +
	'continua liberado para tudo. Arquivo de outra equipe e somente leitura para voce; ' +
	'arquivo sem dono nenhum so pode ser alterado pelo Gerenciador ou pelo Integrador ' +
	'Revisor. Pastas cobrem tudo que esta dentro, inclusive arquivos criados depois. ' +
	'team_status mostra sua equipe, o que voce pode alterar e (com path) de quem e um ' +
	'arquivo - consulte antes de gravar em algo novo. team_list mostra todas as equipes e ' +
	'agentes. Entrar em equipe e definitivo: team_leave so funciona se o usuario liberar a ' +
	'saida. ALISTAMENTO AUTOMATICO: se o usuario nao disser em qual equipe voce entra, chame ' +
	'team_enlist - o site escolhe sozinho a equipe que mais precisa de gente, te registra na ' +
	'hora e te da um nome novo baseado nela (ex.: agente-fisica). A resposta traz o SEU NOVO ' +
	'NOME: use agent="ESSE NOME" em todas as chamadas seguintes. NOME UNICO: dois agentes ' +
	'nao podem ter o mesmo nome - se o nome que voce declarou ja for de outro agente ativo, ' +
	'o site te registra com um nome livre (ex.: agente-fisica-2) e avisa na resposta; passe ' +
	'a usar o nome novo. TODA equipe pertence a UM projeto: passe project="nome do projeto" ' +
	'em team_join, team_status, team_list, file_lock/file_unlock/file_locks, review_* e ' +
	'msg_* - a posse dos arquivos so vale dentro do projeto da equipe, entao o mesmo caminho ' +
	'pode ter donos diferentes em projetos diferentes. Equipes nativas do site: "Integrador ' +
	'Revisor" (verifica a compatibilidade entre as mudancas de todas as equipes e pode ' +
	'escrever em qualquer arquivo) e "Gerenciador" (administra as equipes pelo MCP). SE VOCE ' +
	'E O GERENCIADOR: so voce pode usar team_create (cria a equipe no projeto ja com os ' +
	'arquivos/pastas dela), team_add_files e team_remove_files (define o que cada equipe ' +
	'altera), team_rename, team_set_desc, team_allow_leave (libera a saida), ' +
	'team_remove_agent e team_delete. Qualquer outro agente que tentar e recusado e a ' +
	'tentativa fica na auditoria. Fluxo do Gerenciador: team_list -> team_create ' +
	'name="Fisica" paths=["src/fisica/"] project="MeuJogo" -> avise o agente responsavel a ' +
	'entrar com team_join. Ao terminar suas tarefas, avise o usuario para mandar a lista de ' +
	'arquivos alterados ao Integrador Revisor. TRAVAS DE ARQUIVO (ler junto pode, gravar nao)' +
	': varios agentes podem LER o mesmo arquivo ao mesmo tempo - leitura nunca espera outro ' +
	'leitor. O que a trava impede e a GRAVACAO: ninguem altera um arquivo que outro agente ' +
	'esta lendo ou reescrevendo agora. Voce nao precisa pedir trava nenhuma para trabalhar: ' +
	'o site trava sozinho, no nome de quem chamou, quando a chamada entra, e solta assim que ' +
	'a resposta sai (a leitura ainda segura por poucos segundos depois de responder). Leu, ' +
	'respondeu, liberou; editou, respondeu, liberou - e o arquivo ja aceita leitura e novas ' +
	'edicoes na hora. Nao ha prazo de minutos nisso: se uma chamada morrer no meio, a trava ' +
	'dela e varrida sozinha. Se outro agente gravar depois da sua ultima leitura, a sua ' +
	'gravacao e recusada: leia de novo e refaca em cima da versao nova, para nao apagar o ' +
	'trabalho dele. file_lock existe so para o caso especial de segurar um arquivo ENTRE ' +
	'varias chamadas (refatoracao grande): mode="escrita" e exclusiva (os outros nem leem, ' +
	'para nao pegarem versao pela metade) e mode="leitura" deixa os outros lerem junto sem ' +
	'ninguem gravar; essa sim conta em minutos e voce solta com file_unlock. Se voce tentar ' +
	'alterar um arquivo que esta na mao de outro agente (ou ler um que esta sendo reescrito),' +
	' a chamada e recusada INTEIRA: espere alguns segundos e repita, ou combine por ' +
	'post_message. Nunca contorne gravando em outro arquivo. Solte com file_unlock assim que ' +
	'terminar e veja o cenario com file_locks. Regra pratica em equipe grande: file_locks -> ' +
	'file_lock nos seus arquivos -> trabalhe -> file_unlock. REVISAO DE INTEGRACAO ' +
	'(Integrador Revisor): quando voce TERMINAR um bloco de trabalho, nao pare por ai - ' +
	'chame review_submit com files=[arquivos que voce alterou], note="o que mudou" e ' +
	'project. Isso abre um pedido para o Integrador Revisor conferir se as suas mudancas ' +
	'continuam compativeis com o que as OUTRAS equipes fizeram (e o que evita o projeto ' +
	'quebrar por incompatibilidade quando dezenas de agentes mexem ao mesmo tempo). Voce so ' +
	'pode submeter arquivos que a sua equipe pode alterar. Antes de mexer em um arquivo, use ' +
	'review_deps path="..." para ver quem importa ele e de que equipe: e mais barato ' +
	'descobrir a dependencia antes de quebrar. review_list mostra os pedidos abertos e ' +
	'review_cancel cancela um pedido seu que ficou incompleto. review_get id="3" mostra o ' +
	'dossie completo (quem usa cada arquivo, imports quebrados, arquivos travados, o mesmo ' +
	'arquivo em dois pedidos). SO o agente da equipe nativa "Integrador Revisor" usa ' +
	'review_decide (aprovado/reprovado com parecer; reprovar exige dizer o motivo) - ' +
	'qualquer outro agente e recusado e a tentativa fica na auditoria. Se voce E o revisor: ' +
	'leia o dossie com review_get, confira os itens marcados [OUTRA EQUIPE], e lembre que ' +
	'voce PODE escrever em qualquer arquivo para consertar a incompatibilidade em vez de so ' +
	'reprovar. Solte suas travas com file_unlock antes de pedir revisao, senao o revisor nao ' +
	'consegue ler os arquivos. CONVERSA ENTRE AGENTES: voce trabalha ao lado de outros ' +
	'agentes e nao enxerga a tela deles. list_agents mostra quem esta ativo agora, de que ' +
	'equipe, quais arquivos cada um esta segurando travado e quem tem recado sem ler - ' +
	'consulte antes de mexer em algo compartilhado ou quando esbarrar em uma trava. msg_send ' +
	'manda recado para UM agente (to="nome"), para uma EQUIPE inteira (team="nome da equipe")' +
	' ou para todos (sem to e sem team); use para pedir uma mudanca em arquivo que nao e seu,' +
	' avisar que terminou uma parte, pedir para soltarem uma trava ou combinar quem faz o ' +
	'que. msg_inbox le a SUA caixa (o que veio para voce, para a sua equipe e para todos) e ' +
	'marca como lido; leia ao comecar e ao terminar cada etapa, porque e por ali que outra ' +
	'equipe avisa que mexeu em algo que voce usa. Falar nunca altera arquivo: comunicacao e ' +
	'sempre permitida, mesmo sem equipe. NOTIFICACAO DE MENSAGENS: quando chega recado, a ' +
	'proxima resposta de qualquer ferramenta comeca com UMA linha [NOTIFICACAO] dizendo ' +
	'quantas mensagens nao lidas voce tem; leia com msg_inbox e responda com msg_send. ' +
	'ARQUIVOS GLOBAIS: o agente Gerenciador pode marcar caminhos como globais ' +
	'(team_global_add, team_global_remove); eles nao tem dono e QUALQUER equipe registrada ' +
	'pode altera-los (README, changelog, docs). Qualquer agente consulta a lista com ' +
	'team_globals ou team_status; avise as outras equipes por msg_send e use file_lock antes ' +
	'de reescrever um global. EQUIPE NATIVA PLANEJADOR / DIVISOR (uma vaga, como as outras ' +
	'nativas): ela NAO altera arquivo nenhum. Planeja a arquitetura do sistema que o usuario ' +
	'pediu e divide o trabalho entre as equipes existentes, entregando UM PROMPT POR EQUIPE ' +
	'para o usuario rodar todas em paralelo, com o contrato de API copiado igual em todos os ' +
	'prompts e a instrucao final de cada equipe avisar o Integrador Revisor por msg_send com ' +
	'os arquivos que alterou, para ele revisar tudo junto. A ferramenta plan_split devolve o ' +
	'dossie (equipes, arquivos de cada uma, globais e arquivos sem dono) e so o agente dessa ' +
	'equipe pode usar.' +
	('\n' +
		'\n' +
		'== SYNAPSE FORGE: MODELAGEM 3D POR CODIGO (ferramenta model3d, acoes forge e docs) ==\n' +
		'Assets de jogo DE VERDADE por codigo, sem empilhar primitivas: model3d {action:"forge", ' +
		'code:"..."} executa seu JS em sandbox com a biblioteca AuroraForge (F), salva o .glb no ' +
		'projeto e devolve na hora a FICHA TECNICA com IMAGEM (7 vistas + medidas + avisos de ' +
		'validacao) para voce corrigir e iterar.\n' +
		'Fluxo: 1) model3d {action:"docs"} (topicos: fluxo, mesh, editar, csg, uv, textura, ' +
		'material, rig, animacao, softbody, exportar, validar, terminal, exemplos); 2) forge com ' +
		'code terminando em return model; 3) leia avisos + imagem, corrija o code, repita (mesmo ' +
		'path sobrescreve com snapshot); 4) use o .glb no jogo pelo caminho relativo.\n' +
		'Recursos: lathe/extrude/sweep/loft, CSG union/subtract/intersect, selecao com falloff, ' +
		'displace/twist/taper/bend/mirror/array, subdivide, UVs box/planar/cylindrical/spherical,' +
		' texturas procedurais (fbm, worley, tijolos, madeira, riscos, manchas), PBR completo ' +
		'(baseColor, metallic, roughness, normalMap, emissive, AO, alpha), RIG com esqueleto ' +
		'proprio ou humanoide pronto (pesos automaticos + pintura manual, skin real no .glb), ' +
		'ANIMACOES por keyframes (varios clips nomeados no mesmo .glb) e SOFTBODY (particulas, ' +
		'molas e pinos exportados em extras para o runtime do jogo) - tudo com validacao ' +
		'automatica.\n' +
		'Terminal (alternativa): forge com install_cli:true instala tools/forge.mjs; rode com ' +
		'run_command: node tools/forge-exemplo.mjs. O runtime garantido do relay e Node (nao ha ' +
		'Python embutido).');
MCP_INSTRUCTIONS +=
	'\n' +
	'\n' +
	'CODIFICACAO ANTI-WAF (ativa so para clientes cujo backend regrava o resultado atras de ' +
	'um WAF, como o Notion; os demais recebem o arquivo cru). Nos RESULTADOS das ferramentas ' +
	'ha tres trocas 1-para-1: ⟨ no lugar do sinal de menor-que; ∶ no lugar dos dois-pontos ' +
	'em URIs de script (javascript∶, vbscript∶) e em data∶text/html; ＝ no lugar do igual em ' +
	'atributos de evento (onclick, onerror e afins). Motivo: a borda do Notion responde 403 ' +
	'a esse texto e o chat para de gravar no meio da tarefa. Nada mais foi alterado, e o ' +
	'proprio resultado avisa com o prefixo [WAF]. Para gravar, mande o texto do jeito que ' +
	'preferir (com esses caracteres ou com os originais): o servidor desfaz a troca antes de ' +
	'escrever, byte a byte. Vale para content, old_str e new_str de create_file, write_file, ' +
	'write_files, edit_file e search/replace. Se precisar de um desses caracteres ' +
	'literalmente no arquivo, escreva-o como entidade HTML numerica (codigos 10216, 8758 e ' +
	'65309).';
function mcpWafSeguro(o) {
	try {
		return typeof wafSanearObj === 'function' ? wafSanearObj(o) : o;
	} catch (e) {
		return o;
	}
}
function mcpWafLigado(cli) {
	try {
		return typeof wafAtivoPara === 'function' ? wafAtivoPara(cli) : false;
	} catch (e) {
		return false;
	}
}
function mcpWafArgs(p) {
	try {
		if (!p || typeof p !== 'object' || typeof wafDecodificarArgs !== 'function') return p;
		const c = Object.assign({}, p);
		if (c.arguments) c.arguments = wafDecodificarArgs(c.arguments, true);
		return c;
	} catch (e) {
		return p;
	}
}
function mcpWafSaida(r) {
	try {
		return typeof wafCodificarResultado === 'function' ? wafCodificarResultado(r, true) : r;
	} catch (e) {
		return r;
	}
}
async function mcpHandleMessage(msg) {
	if (Array.isArray(msg)) {
		const out = [];
		for (const m of msg) {
			const r = await mcpHandleOne(m);
			if (r) out.push(r);
		}
		return out.length ? out : null;
	}
	return mcpHandleOne(msg);
}
async function mcpHandleOne(msg) {
	if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string')
		return {
			jsonrpc: '2.0',
			id: msg && msg.id != null ? msg.id : null,
			error: { code: -32600, message: 'Requisição inválida' },
		};
	const isNotif = msg.id === undefined;
	let wrapped = null;
	const __wafOn = mcpWafLigado(msg._cli);
	let __par = msg.params || {};
	if (__wafOn && msg.method === 'tools/call') __par = mcpWafArgs(__par);
	try {
		wrapped = await mcpDispatch(msg.method, __par);
	} catch (e) {
		if (isNotif) return null;
		return {
			jsonrpc: '2.0',
			id: msg.id,
			error: { code: -32603, message: String((e && e.message) || e) },
		};
	}
	if (isNotif) return null;
	if (wrapped === null)
		return {
			jsonrpc: '2.0',
			id: msg.id,
			error: { code: -32601, message: 'Método não suportado: ' + msg.method },
		};
	if (__wafOn && msg.method === 'tools/call')
		return { jsonrpc: '2.0', id: msg.id, result: mcpWafSaida(wrapped.ok) };
	return { jsonrpc: '2.0', id: msg.id, result: wrapped.ok };
}
async function mcpDispatch(method, params) {
	if (method === 'initialize') {
		const _cli = (params.clientInfo && params.clientInfo.name) || 'desconhecido';
		try {
			if (typeof wafRegistrarCliente === 'function') wafRegistrarCliente(_cli);
		} catch (e) {
			ignorarErro(e, 'mcpDispatch');
		}
		if (_cli !== 'aurora-cache' && _cli !== 'synapse-autoteste')
			mcpLog('ok', `Cliente MCP conectado (${_cli})`);
		const known = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
		const pv = known.includes(params.protocolVersion) ? params.protocolVersion : '2025-03-26';
		return {
			ok: mcpWafSeguro({
				protocolVersion: pv,
				capabilities: { tools: { listChanged: false } },
				serverInfo: {
					name: 'aurora-live-preview',
					title: 'Synapse Live Preview (site de preview de .zip)',
					version: '1.0.0',
				},
				instructions: MCP_INSTRUCTIONS,
			}),
		};
	}
	if (method === 'ping') return { ok: {} };
	if (method.indexOf('notifications/') === 0) return { ok: {} };
	if (method === 'tools/list') {
		agEnsureProps();
		const temCompl = termTemComplemento();
		return {
			ok: mcpWafSeguro({
				tools: MCP_TOOLS.filter((t) => temCompl || !MCP_TOOLS_COMPL.has(t.name)).map((t) => ({
					name: t.name,
					title: t.title,
					description: t.desc,
					inputSchema: t.schema,
				})),
			}),
		};
	}
	if (method === 'tools/call') return { ok: await mcpToolCall(params) };
	if (method === 'resources/list') return { ok: { resources: [] } };
	if (method === 'resources/templates/list') return { ok: { resourceTemplates: [] } };
	if (method === 'prompts/list') return { ok: { prompts: [] } };
	return null;
}
function mcpArgHint(args) {
	if (!args) return '';
	const k =
		args.path ||
		args.from ||
		args.query ||
		args.name ||
		args.project ||
		(Array.isArray(args.paths) ? args.paths.join(', ') : '');
	return k ? ' · ' + String(k).slice(0, 60) : '';
}
async function mcpToolCall(params) {
	const name = params && params.name;
	const args = (params && params.arguments) || {};
	const tool = MCP_TOOLS.find((t) => t.name === name);
	const __eu = typeof ntQuemSou === 'function' ? ntQuemSou(args) : agName(args);
	const __sub = typeof ntSubFerramenta === 'function' ? ntSubFerramenta(tool, name, args) : name;
	const __ntag = function () {
		try {
			return typeof ntTag === 'function' ? ntTag(__eu, __sub) : '';
		} catch (e) {
			return '';
		}
	};
	if (!tool)
		return {
			content: [{ type: 'text', text: __ntag() + 'Ferramenta desconhecida: ' + name }],
			isError: true,
		};
	MCP.calls++;
	const agTag = agName(args) ? `[${agName(args)}] ` : '';
	let __tmCtx = null;
	try {
		if (AG_WRITE.has(name)) {
			const agP = agProjQuiet(args);
			if (agP) agGate(agP, name, args);
		}
		__tmCtx = await tmBegin(name, args);
		const out = await tool.run(args);
		tmEnd(__tmCtx, true, null);
		__tmCtx = null;
		agTrack(agName(args), name, args, 1);
		mcpLog('ok', agTag + name + mcpArgHint(args));
		mcpRenderPanel();
		const __nt = __ntag();
		if (out && typeof out === 'object' && Array.isArray(out.__content)) {
			if (__nt) {
				if (out.__content[0] && out.__content[0].type === 'text')
					out.__content[0].text = __nt + out.__content[0].text;
				else out.__content.unshift({ type: 'text', text: __nt });
			}
			return { content: out.__content };
		}
		return {
			content: [
				{
					type: 'text',
					text: __nt + (typeof out === 'string' ? out : JSON.stringify(out, null, 2)),
				},
			],
		};
	} catch (e) {
		if (__tmCtx) {
			tmEnd(__tmCtx, false, e);
			__tmCtx = null;
		}
		agTrack(agName(args), name, args, 0);
		mcpLog('err', agTag + name + ': ' + ((e && e.message) || e));
		mcpRenderPanel();
		const __nte = __ntag();
		return {
			content: [{ type: 'text', text: __nte + 'Erro: ' + ((e && e.message) || e) }],
			isError: true,
		};
	}
}

const VIS = { seq: 1, pending: new Map() };
const HEADLESS = { map: new Map(), MAX: 3, W: 1280, H: 720 };
function headlessProjBySource(src) {
	for (const [pid, h] of HEADLESS.map) {
		if (h.ifr && h.ifr.contentWindow === src)
			return State.projects.find((p) => p.id === pid) || null;
	}
	return null;
}
function headlessDestroy(projId) {
	const h = HEADLESS.map.get(projId);
	if (!h) return;
	try {
		if (h.ifr) h.ifr.remove();
	} catch (e) {
		ignorarErro(e, 'headlessDestroy');
	}
	HEADLESS.map.delete(projId);
}
function headlessWaitReady(h, ms) {
	return new Promise((res) => {
		let done = false;
		h.onReady = () => {
			if (done) return;
			done = true;
			res(true);
		};
		setTimeout(() => {
			if (done) return;
			done = true;
			res(false);
		}, ms || 8000);
	});
}
function headlessRefresh(proj, html) {
	const h = HEADLESS.map.get(proj.id);
	if (!h || h.dev) return;
	if (proj.id === State.active) {
		headlessDestroy(proj.id);
		return;
	}
	h.ready = headlessWaitReady(h, 8000);
	h.ifr.srcdoc = html;
}
async function headlessEnsure(proj) {
	let h = HEADLESS.map.get(proj.id);
	const dv = typeof DEV !== 'undefined' && DEV.map ? DEV.map[proj.id] : null;
	if (h && ((h.dev && (!dv || !dv.url || h.src !== dv.url)) || (!h.dev && dv && dv.url))) {
		headlessDestroy(proj.id);
		h = null;
	}
	if (!h) {
		if (HEADLESS.map.size >= HEADLESS.MAX) {
			let oldId = null,
				oldT = Infinity;
			for (const [pid, hh] of HEADLESS.map) {
				if (hh.t < oldT) {
					oldT = hh.t;
					oldId = pid;
				}
			}
			if (oldId != null) headlessDestroy(oldId);
		}
		const ifr = document.createElement('iframe');
		ifr.setAttribute('title', 'preview headless');
		ifr.setAttribute('referrerpolicy', 'no-referrer');
		ifr.setAttribute('allow', 'pointer-lock; fullscreen; gamepad; autoplay');
		ifr.setAttribute(
			'sandbox',
			'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals',
		);
		ifr.setAttribute('aria-hidden', 'true');
		ifr.tabIndex = -1;
		const vpw = (proj.viewport && proj.viewport.w) || HEADLESS.W,
			vph = (proj.viewport && proj.viewport.h) || HEADLESS.H;
		ifr.style.cssText = `position:fixed;left:0;top:0;width:${vpw}px;height:${vph}px;opacity:0.001;pointer-events:none;z-index:-1;border:0;`;
		document.body.appendChild(ifr);
		h = { ifr, t: Date.now(), dev: false, src: null, ready: Promise.resolve(false), onReady: null };
		HEADLESS.map.set(proj.id, h);
		if (dv && dv.url) {
			h.dev = true;
			h.src = dv.url;
			h.ready = headlessWaitReady(h, 15000);
			ifr.src = dv.url;
		} else {
			if (!proj.lastHtml) {
				logCmd(proj, '⚙ Montando preview headless…');
				await buildPreview(proj);
			}
			if (!proj.lastHtml) {
				headlessDestroy(proj.id);
				throw new Error(
					`Não consegui montar o preview headless de "${proj.name}" (projeto vazio ou sem HTML de entrada). Use refresh_preview, confira os arquivos ou ative o projeto na tela.`,
				);
			}
			h.ready = headlessWaitReady(h, 10000);
			ifr.srcdoc = proj.lastHtml;
		}
		logCmd(proj, `👁 Preview headless ativo (${vpw}x${vph}) para as ferramentas de visão.`);
	}
	h.t = Date.now();
	await h.ready;
	if (!h.ifr || !h.ifr.contentWindow)
		throw new Error(
			`Preview headless indisponível para "${proj.name}". Tente de novo ou ative o projeto na tela.`,
		);
	return h;
}
window.addEventListener('message', (e) => {
	const d = e.data;
	if (!d) return;
	const isMain = el.frame && e.source === el.frame.contentWindow;
	const hproj = isMain ? null : headlessProjBySource(e.source);
	if (!isMain && !hproj) return;
	if (d.__lp_vision_ready) {
		if (hproj && d.loaded) {
			const h = HEADLESS.map.get(hproj.id);
			if (h && h.onReady) h.onReady();
		}
		return;
	}
	if (!d.__lp_vision_result) return;
	const p = VIS.pending.get(d.id);
	if (!p) return;
	VIS.pending.delete(d.id);
	clearTimeout(p.timer);
	if (d.ok) p.res(d);
	else p.rej(new Error(d.error || 'Falha na ponte de visão'));
});
async function visionCall(proj, action, args, timeoutMs) {
	let win,
		vw,
		vh,
		headless = false;
	if (proj.id === State.active) {
		win = el.frame && el.frame.contentWindow;
		if (!win)
			throw new Error(
				'Preview indisponível (iframe não montado). Use refresh_preview e tente de novo.',
			);
		const rect = el.frame.getBoundingClientRect();
		if (rect.width < 40 || rect.height < 40)
			throw new Error(
				`O preview está oculto ou recolhido na tela (${Math.round(rect.width)}x${Math.round(rect.height)}). Abra o painel de preview e tente de novo.`,
			);
		vw = Math.round(el.frame.offsetWidth || rect.width);
		vh = Math.round(el.frame.offsetHeight || rect.height);
	} else {
		const h = await headlessEnsure(proj);
		win = h.ifr.contentWindow;
		vw = (proj.viewport && proj.viewport.w) || HEADLESS.W;
		vh = (proj.viewport && proj.viewport.h) || HEADLESS.H;
		headless = true;
	}
	const a = Object.assign({}, args || {}, { __vw: vw, __vh: vh });
	const r = await new Promise((res, rej) => {
		const id = 'v' + VIS.seq++;
		const timer = setTimeout(() => {
			if (VIS.pending.has(id)) {
				VIS.pending.delete(id);
				rej(
					new Error(
						`Tempo esgotado aguardando o preview responder (${action}).${headless ? ' O preview headless roda em segundo plano e o navegador pode reduzir a velocidade dele; tente de novo ou ative o projeto na tela para timing real.' : ' O preview pode estar travado ou recompilando; confira com console_logs e tente de novo.'}`,
					),
				);
			}
		}, timeoutMs || 12000);
		VIS.pending.set(id, { res, rej, timer });
		try {
			win.postMessage({ __lp_vision: true, id: id, action: action, args: a }, '*');
		} catch (e) {
			clearTimeout(timer);
			VIS.pending.delete(id);
			rej(e);
		}
	});
	try {
		Object.defineProperty(r, '__headless', { value: headless, enumerable: false });
	} catch (e) {
		r.__headless = headless;
	}
	return r;
}
async function burstFilmstrip(frames, intervalMs, fmt, q) {
	const imgs = [];
	for (const du of frames) {
		imgs.push(
			await new Promise((res, rej) => {
				const im = new Image();
				im.onload = () => res(im);
				im.onerror = () => rej(new Error('Falha ao decodificar um frame da rajada.'));
				im.src = du;
			}),
		);
	}
	const cols = imgs.length <= 4 ? imgs.length : Math.ceil(imgs.length / 2);
	const rows = Math.ceil(imgs.length / cols);
	const cw = Math.max.apply(
			null,
			imgs.map((i) => i.width),
		),
		ch = Math.max.apply(
			null,
			imgs.map((i) => i.height),
		);
	const lab = 20,
		pad = 6;
	const W = pad + cols * (cw + pad),
		H = pad + rows * (ch + lab + pad);
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = H;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#14161c';
	ctx.fillRect(0, 0, W, H);
	imgs.forEach((im, i) => {
		const cx = pad + (i % cols) * (cw + pad),
			cy = pad + Math.floor(i / cols) * (ch + lab + pad);
		ctx.fillStyle = '#0a0b0f';
		ctx.fillRect(cx, cy, cw, lab);
		ctx.fillStyle = '#e8eaf0';
		ctx.font = 'bold 12px system-ui,sans-serif';
		ctx.textBaseline = 'middle';
		ctx.fillText(`F${i}${1}  +${Math.round(i * intervalMs)}ms`, cx + 6, cy + lab / 2, cw - 12);
		ctx.fillStyle = '#000';
		ctx.fillRect(cx, cy + lab, cw, ch);
		ctx.drawImage(
			im,
			cx + Math.round((cw - im.width) / 2),
			cy + lab + Math.round((ch - im.height) / 2),
		);
		ctx.strokeStyle = '#3a3f4d';
		ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch + lab - 1);
	});
	const dw = 96;
	const px = imgs.map((im) => {
		const c = document.createElement('canvas');
		c.width = dw;
		c.height = Math.max(1, Math.round((dw * im.height) / Math.max(1, im.width)));
		const x = c.getContext('2d');
		x.drawImage(im, 0, 0, c.width, c.height);
		return { d: x.getImageData(0, 0, c.width, c.height).data, n: c.width * c.height };
	});
	const diffs = [];
	for (let i = 1; i < px.length; i++) {
		const A = px[i - 1],
			B = px[i];
		let chg = 0;
		const nb = Math.min(A.d.length, B.d.length);
		for (let j = 0; j < nb; j += 4) {
			if (
				Math.abs(A.d[j] - B.d[j]) > 12 ||
				Math.abs(A.d[j + 1] - B.d[j + 1]) > 12 ||
				Math.abs(A.d[j + 2] - B.d[j + 2]) > 12
			)
				chg++;
		}
		diffs.push((chg / Math.max(1, Math.min(A.n, B.n))) * 100);
	}
	return { dataUrl: cv.toDataURL(fmt, q), diffs: diffs, w: W, h: H };
}
function burstVerdict(diffs) {
	const TH = 0.1;
	if (!diffs.length) return 'apenas 1 quadro capturado — sem análise de movimento';
	const moving = diffs.map((d) => d >= TH);
	if (moving.every((m) => m)) return 'movimento contínuo detectado em todos os intervalos';
	if (moving.every((m) => !m))
		return 'NENHUM movimento detectado — animação parada, jogo pausado ou tela estática';
	const parts = [];
	for (let i = 0; i < moving.length; i++) if (!moving[i]) parts.push(`F${i}${1}→F${i}${2}`);
	return 'movimento PARCIAL — sem mudança em: ' + parts.join(', ');
}
function interactBudget(steps) {
	let t = 8000;
	for (const s of Array.isArray(steps) ? steps : []) {
		t += 300;
		if (!s) continue;
		if (s.action === 'wait') t += Math.min(5000, Number(s.ms) || 500);
		if (s.action === 'key') t += Math.min(3000, Number(s.hold_ms) || 0);
		if (s.action === 'chord')
			t +=
				Math.min(5000, Number(s.hold_ms) || 400) +
				(Array.isArray(s.press) ? s.press.length : s.press != null ? 1 : 0) * 120;
		if (s.action === 'gamepad') t += Math.min(5000, Number(s.hold_ms) || 0);
		if (
			s.action === 'drag' ||
			s.action === 'touch_drag' ||
			s.action === 'pinch' ||
			s.action === 'look'
		)
			t += Math.min(5000, Number(s.ms) || 400) + 200;
		if (s.action === 'tap') t += Math.min(500, Number(s.ms) || 60);
	}
	return Math.min(120000, t);
}

function lintBlankKeep(m, p1) {
	p1 = p1 || '';
	return p1 + m.slice(p1.length).replace(/[^\n]/g, ' ');
}
function lintBlank(m) {
	return String(m).replace(/[^\n]/g, ' ');
}
function lintBlankVar(m) {
	const ind = (String(m).match(/^[ \t]*/) || [''])[0];
	let r = ind + 'var __dflt=';
	while (r.length < String(m).length) r += ' ';
	return r;
}
function stripModuleSyntax(src) {
	return src
		.replace(/\bimport\.meta\b/g, '__im_meta__')
		.replace(
			/^[ \t]*import\b(?![ \t]*[(.])[^'"();]{0,400}?['"][^'"\n]*['"][ \t]*(?:(?:assert|with)[ \t]*\{[^}]*\})?[ \t]*;?/gm,
			lintBlank,
		)
		.replace(/^[ \t]*import[ \t]*['"][^'"\n]*['"][ \t]*;?/gm, lintBlank)
		.replace(/^[ \t]*export[ \t]+default\b/gm, lintBlankVar)
		.replace(
			/^[ \t]*export[ \t]*\{[^}]*\}[ \t]*(?:from[ \t]*['"][^'"\n]*['"])?[ \t]*;?/gm,
			lintBlank,
		)
		.replace(
			/^[ \t]*export[ \t]*\*[ \t]*(?:as[ \t]+[A-Za-z_$][\w$]*[ \t]*)?from[ \t]*['"][^'"\n]*['"][ \t]*;?/gm,
			lintBlank,
		)
		.replace(
			/^[ \t]*export[ \t]+(?=(?:const|let|var|function|class|async|type|interface|enum|abstract|declare)\b)/gm,
			lintBlank,
		);
}
function jsBalanceHint(src) {
	const pairs = { '}': '{', ')': '(', ']': '[' };
	const opens = '{([';
	const stack = [];
	let line = 1,
		mode = 0,
		q = '';
	for (let i = 0; i < src.length; i++) {
		const ch = src[i],
			nx = src[i + 1];
		if (ch === '\n') line++;
		if (mode === 0) {
			if (ch === '/' && nx === '/') mode = 4;
			else if (ch === '/' && nx === '*') {
				mode = 5;
				i++;
			} else if (ch === "'" || ch === '"') {
				mode = 1;
				q = ch;
			} else if (ch === '`') mode = 3;
			else if (opens.includes(ch)) stack.push({ ch: ch, line: line });
			else if (pairs[ch]) {
				const top = stack.pop();
				if (!top || top.ch !== pairs[ch])
					return `possível desbalanceamento: '${ch}' na linha ${line} sem abertura correspondente`;
			}
		} else if (mode === 1) {
			if (ch === '\\') i++;
			else if (ch === q || ch === '\n') mode = 0;
		} else if (mode === 3) {
			if (ch === '\\') i++;
			else if (ch === '`') mode = 0;
		} else if (mode === 4) {
			if (ch === '\n') mode = 0;
		} else if (mode === 5) {
			if (ch === '*' && nx === '/') {
				mode = 0;
				i++;
			}
		}
	}
	if (stack.length) {
		const t = stack[stack.length - 1];
		return `possível desbalanceamento: '${t.ch}' aberto na linha ${t.line} sem fechamento`;
	}
	return null;
}
function lintPreparaJs(src) {
	return String(src == null ? '' : src)
		.replace(/^\uFEFF/, '')
		.replace(/^#![^\n]*/, lintBlank);
}
function lintTentaScript(code) {
	return validarSintaxe(code, { assincrono: true });
}
var LINT_ERRO_DE_MODULO =
	/cannot use import statement|cannot use 'import\.meta'|import\.meta may only appear|unexpected (?:token|keyword|identifier) '?(?:export|import|from)'?|(?:import|export) declarations may only appear|may not be used as an identifier in module|new\.target|await is only valid/i;
function lintTentaBabel(code, filename) {
	if (!window.Babel || typeof window.Babel.transform !== 'function') return undefined;
	const presets = [];
	try {
		if (
			window.Babel.availablePresets &&
			window.Babel.availablePresets.react &&
			/<\/[A-Za-z]|<[A-Za-z][\w.:-]*[ \t\r\n\/>]/.test(code)
		)
			presets.push('react');
	} catch (e) {
		ignorarErro(e, 'lintTentaBabel');
	}
	try {
		window.Babel.transform(code, {
			presets: presets,
			filename: filename || 'arquivo.js',
			code: false,
			ast: false,
			babelrc: false,
			configFile: false,
			sourceType: 'unambiguous',
			parserOpts: {
				allowAwaitOutsideFunction: true,
				allowReturnOutsideFunction: true,
				allowSuperOutsideMethod: true,
				allowUndeclaredExports: true,
			},
		});
		return null;
	} catch (e) {
		const m = String((e && e.message) || e);
		if (
			/unknown option|unknown preset|not available|cannot find|is not a function|invalid preset/i.test(
				m,
			)
		)
			return undefined;
		return m;
	}
}
function lintJs(src, opts) {
	const code = lintPreparaJs(src);
	if (lintTentaScript(code) === null) return null;
	const erro = lintTentaScript(stripModuleSyntax(code));
	if (erro === null) return null;
	const eBabel = lintTentaBabel(code, (opts && opts.filename) || 'arquivo.js');
	if (eBabel === null) return null;
	if (eBabel === undefined && LINT_ERRO_DE_MODULO.test(erro)) {
		const dica0 = jsBalanceHint(code);
		return dica0 ? `possível erro de sintaxe JS (${dica0})` : null;
	}
	let msg = 'erro de sintaxe JS: ' + String(eBabel === undefined ? erro : eBabel).split('\n')[0];
	const dica = jsBalanceHint(code);
	if (dica) msg += ` (${dica})`;
	return msg;
}
function cssBalanceHint(src) {
	let depth = 0,
		line = 1,
		mode = 0,
		q = '';
	for (let i = 0; i < src.length; i++) {
		const ch = src[i],
			nx = src[i + 1];
		if (ch === '\n') line++;
		if (mode === 0) {
			if (ch === '/' && nx === '*') {
				mode = 5;
				i++;
			} else if (ch === '"' || ch === "'") {
				mode = 1;
				q = ch;
			} else if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth < 0) return "'}' extra na linha " + line;
			}
		} else if (mode === 1) {
			if (ch === '\\') i++;
			else if (ch === q || ch === '\n') mode = 0;
		} else if (mode === 5) {
			if (ch === '*' && nx === '/') {
				mode = 0;
				i++;
			}
		}
	}
	if (depth > 0) return depth + " chave(s) '{' sem fechamento até o fim";
	return null;
}
function posToLineCol(text, pos) {
	let l = 1,
		c = 1;
	for (let i = 0; i < pos && i < text.length; i++) {
		if (text[i] === '\n') {
			l++;
			c = 1;
		} else c++;
	}
	return `linha ${l}, coluna ${c}`;
}
function lintFile(path, text) {
	const ext = Core.extname(path);
	const issues = [];
	if (ext === '.json') {
		try {
			JSON.parse(text);
		} catch (e) {
			const msg = String((e && e.message) || e);
			const pm = msg.match(/position\s+(\d+)/i);
			issues.push('JSON inválido: ' + msg + (pm ? ` (${posToLineCol(text, Number(pm[1]))})` : ''));
		}
		return issues;
	}
	if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
		const m = lintJs(text);
		if (m) issues.push(m);
		return issues;
	}
	if (ext === '.jsx' || ext === '.ts' || ext === '.tsx') {
		if (window.Babel) {
			try {
				const presets = [];
				if (ext !== '.jsx')
					presets.push(['typescript', { isTSX: ext === '.tsx', allExtensions: true }]);
				if (ext !== '.ts') presets.push('react');
				window.Babel.transform(text, { presets: presets, filename: 'f' + ext });
			} catch (e) {
				issues.push(
					`erro de sintaxe (${ext.slice(1).toUpperCase()}): ${String((e && e.message) || e).split('\n')[0]}`,
				);
			}
		}
		return issues;
	}
	if (ext === '.css') {
		const m = cssBalanceHint(text);
		if (m) issues.push('CSS: ' + m);
		return issues;
	}
	if (ext === '.html' || ext === '.htm') {
		const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
		let m;
		while ((m = re.exec(text))) {
			const attrs = m[1] || '';
			if (/\bsrc\s*=/i.test(attrs)) continue;
			const ty = ((attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '').toLowerCase();
			if (ty && ty !== 'module' && !ty.includes('javascript')) continue;
			const baseLine = text.slice(0, m.index).split('\n').length;
			const err = lintJs(m[2]);
			if (err) issues.push(`<script${ty ? ' type=' + ty : ''}> da linha ${baseLine}: ${err}`);
		}
		const res = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
		let ms;
		while ((ms = res.exec(text))) {
			const bl = text.slice(0, ms.index).split('\n').length;
			const ch = cssBalanceHint(ms[1]);
			if (ch) issues.push(`<style> da linha ${bl}: ${ch}`);
		}
		const opens = (text.match(/<script\b/gi) || []).length,
			closes = (text.match(/<\/script\s*>/gi) || []).length;
		if (opens > closes)
			issues.push(
				`tag <script> sem fechamento: ${opens} abertura(s) e ${closes} fechamento(s) de </script>`,
			);
		return issues;
	}
	return issues;
}
function lintSuffix(path, text) {
	let issues = [];
	try {
		issues = lintFile(path, text);
	} catch (e) {
		return '';
	}
	if (!issues.length) return '';
	return (
		'\nATENÇÃO — a verificação de sintaxe encontrou problema(s) (o arquivo FOI salvo mesmo assim; corrija antes de continuar):\n- ' +
		issues.join('\n- ')
	);
}

function mcpProjKey(n) {
	return String(n == null ? '' : n)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
function mcpProj(args) {
	const p = mcpProjRaw(args);
	try {
		tmAdopt(p);
	} catch (e) {
		ignorarErro(e, 'mcpProj');
	}
	return p;
}
function mcpProjRaw(args) {
	if (args && args.project) {
		const raw = String(args.project).trim();
		const q = raw.toLowerCase();
		const qk = mcpProjKey(raw);
		const p =
			State.projects.find((x) => x.id === raw) ||
			State.projects.find((x) => (x.name || '').toLowerCase() === q) ||
			(qk ? State.projects.find((x) => mcpProjKey(x.name) === qk) : null);
		if (!p) {
			const names = State.projects.map((x) => `"${x.name}" (id: ${x.id})`).join(', ');
			throw new Error(
				`Projeto não encontrado: ${raw}. Abertos no editor: ${names || 'nenhum'}. Use list_projects — ou open_project_from_disk se ele existir na pasta do relay.`,
			);
		}
		return p;
	}
	const p = activeProject();
	if (!p)
		throw new Error(
			'Nenhum projeto aberto. Informe "project", use create_project/open_project_from_disk ou peça ao usuário para importar um .zip.',
		);
	return p;
}
function mcpNorm(path) {
	const p = String(path == null ? '' : path)
		.trim()
		.replace(/^\/+/, '')
		.replace(/\/+$/, '');
	if (!p || !validRelPath(p)) throw new Error('Caminho inválido: ' + path);
	return p;
}
function mcpFile(proj, path) {
	const f = proj.files.get(path);
	if (!f) throw new Error(`Arquivo não encontrado: ${path}. Use list_files para ver os caminhos.`);
	return sniffTextEntry(f);
}
function mcpHist(f) {
	if (!f.history) f.history = [];
	const last = f.history[f.history.length - 1];
	if (!last || last.text !== f.text) f.history.push({ t: Date.now(), text: f.text });
	if (f.history.length > 8) f.history.splice(0, f.history.length - 8);
}
function lpOutlineJs(text, base) {
	base = base || 0;
	const out = [];
	const lines = String(text).split('\n');
	const res = [
		[
			/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
			'function',
		],
		[/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
		[
			/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
			'arrow-fn',
		],
		[
			/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
			'function',
		],
		[
			/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*=>/,
			'arrow-fn',
		],
	];
	for (let i = 0; i < lines.length; i++) {
		const L = lines[i];
		let hit = false;
		for (const r of res) {
			const m = r[0].exec(L);
			if (m) {
				out.push({ line: base + i + 1, kind: r[1], name: m[1] });
				hit = true;
				break;
			}
		}
		if (hit) continue;
		const mm =
			/^\s+(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{\s*$/.exec(
				L,
			);
		if (mm && !['if', 'for', 'while', 'switch', 'catch', 'function', 'return'].includes(mm[1]))
			out.push({ line: base + i + 1, kind: 'method', name: mm[1] });
	}
	return out;
}
function lpOutline(path, text) {
	const ext = (Core.extname(path) || '').toLowerCase();
	const lines = String(text).split('\n');
	const out = [];
	if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) return lpOutlineJs(text, 0);
	if (ext === '.md' || ext === '.markdown') {
		for (let i = 0; i < lines.length; i++) {
			const m = /^(#{1,6})\s+(.+)/.exec(lines[i]);
			if (m) out.push({ line: i + 1, kind: 'h' + m[1].length, name: m[2].trim().slice(0, 80) });
		}
		return out;
	}
	if (ext === '.css') {
		let depth = 0;
		for (let i = 0; i < lines.length; i++) {
			const L = lines[i];
			if (depth === 0) {
				const at = /^\s*(@(?:media|keyframes|supports|font-face)[^{]*)\{/.exec(L);
				const m = at ? null : /^\s*([^{}@\/\s][^{]*)\{/.exec(L);
				if (at) out.push({ line: i + 1, kind: 'at-rule', name: at[1].trim().slice(0, 80) });
				else if (m) out.push({ line: i + 1, kind: 'selector', name: m[1].trim().slice(0, 80) });
			}
			for (const ch of L) {
				if (ch === '{') depth++;
				else if (ch === '}') depth = Math.max(0, depth - 1);
			}
		}
		return out;
	}
	if (ext === '.json') {
		try {
			const o = JSON.parse(text);
			if (o && typeof o === 'object' && !Array.isArray(o))
				for (const k of Object.keys(o).slice(0, 60)) out.push({ line: 0, kind: 'key', name: k });
		} catch (e) {
			ignorarErro(e, 'lpOutline');
		}
		return out;
	}
	if (ext === '.html' || ext === '.htm') {
		let inScript = false,
			base = 0,
			buf = [];
		for (let i = 0; i < lines.length; i++) {
			const L = lines[i];
			if (inScript) {
				if (/<\/script/i.test(L)) {
					inScript = false;
					const inner = lpOutlineJs(buf.join('\n'), base);
					for (const s of inner) out.push(s);
				} else buf.push(L);
				continue;
			}
			const ms = /<script\b([^>]*)>/i.exec(L);
			if (ms) {
				if (/src\s*=/i.test(ms[1])) {
					const sm = /src\s*=\s*["']?([^"'\s>]+)/i.exec(ms[1]);
					out.push({ line: i + 1, kind: 'script', name: `<script src=${sm ? sm[1] : '?'}>` });
				} else if (/<\/script/i.test(L.slice(ms.index)))
					out.push({ line: i + 1, kind: 'script', name: '<script> inline' });
				else {
					inScript = true;
					base = i + 1;
					buf = [];
					out.push({ line: i + 1, kind: 'script', name: '<script>' });
				}
				continue;
			}
			if (/<style\b[^>]*>/i.test(L)) out.push({ line: i + 1, kind: 'style', name: '<style>' });
			const mid = /\sid=["']([^"']+)["']/.exec(L);
			if (mid) out.push({ line: i + 1, kind: 'id', name: '#' + mid[1] });
		}
		return out;
	}
	return out;
}
