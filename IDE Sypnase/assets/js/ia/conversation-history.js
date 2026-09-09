'use strict';

(function () {
    const limits = Object.freeze({
        conversations: 24,
        messages: 120,
        conversationCharacters: 600000,
        totalCharacters: 1500000,
    });

    function copyMessage(message) {
      const copy = { role: message.role, content: String(message.content || '') };
      for (const field of ['providerState', 'reasoning', 'metrics', 'model']) {
        if (message[field] != null) copy[field] = message[field];
      }
      if (message.chamadas?.length) {
        copy.chamadas = message.chamadas.map((call) => ({
              id: call.id,
              nome: call.nome,
              args: call.args,
        }));
      }
      if (message.role === 'tool') {
        Object.assign(copy, {
            id: message.id,
            nome: message.nome,
            texto: String(message.texto || ''),
            erro: !!message.erro,
            ms: message.ms || 0,
        });
      }
      return copy;
    }

    function taskGroups(messages) {
      const groups = [];
      for (const message of messages) {
        if (message.role === 'user') groups.push([]);
        if (groups.length) groups[groups.length - 1].push(copyMessage(message));
      }
      return groups;
    }

    function repairInterruptedCalls(messages) {
      const result = [];
      let pending = new Map();

      function closePending() {
        for (const call of pending.values()) {
          result.push({
              role: 'tool',
              id: call.id,
              nome: call.nome,
              texto:
              'A execução foi interrompida antes de salvar o resultado desta ferramenta. Verifique o estado do projeto antes de repetir a ação.',
              erro: true,
              ms: 0,
              imagens: [],
          });
        }
        pending = new Map();
      }

      for (const message of messages) {
        if (message.role !== 'tool') closePending();
        if (message.role === 'tool') {
          if (!pending.has(message.id)) continue;
          pending.delete(message.id);
        }
        result.push({ ...message, imagens: [] });
        if (message.role === 'assistant') {
          for (const call of message.chamadas || []) pending.set(call.id, call);
        }
      }
      closePending();
      return result;
    }

    function restore(record) {
      const messages = taskGroups(Array.isArray(record.mensagens) ? record.mensagens : []).flat();
      return { ...record, mensagens: repairInterruptedCalls(messages) };
    }

    function save(conversation, history) {
      const groups = taskGroups(conversation.mensagens);
      if (!groups.length) return { saved: false, reason: 'empty' };
      const record = {
        id: conversation.id,
        titulo: conversation.titulo,
        criada: conversation.criada,
        atualizada: Date.now(),
        mensagens: [],
      };
      let trimmedTasks = 0;

      function updateMessages() {
        record.mensagens = groups.flat();
      }

      updateMessages();
      while (
        groups.length > 1 &&
        (record.mensagens.length > limits.messages ||
          JSON.stringify(record).length > limits.conversationCharacters)
      ) {
        groups.shift();
        trimmedTasks++;
        updateMessages();
      }
      if (JSON.stringify(record).length > limits.conversationCharacters) {
        return { saved: false, reason: 'large-task' };
      }
      const records = [record, ...history.filter((item) => item.id !== conversation.id)].slice(
        0,
        limits.conversations,
      );
      while (records.length > 1 && JSON.stringify(records).length > limits.totalCharacters) {
        records.pop();
      }
      for (;;) {
        try {
          localStorage.setItem(IA_LS.conversas, JSON.stringify(records));
          return { saved: true, trimmedTasks };
        } catch (error) {
          if (records.length > 1) {
            records.pop();
            continue;
          }
          if (groups.length > 1) {
            groups.shift();
            trimmedTasks++;
            updateMessages();
            continue;
          }
          ignorarErro(error, 'aiConversationHistory');
          return { saved: false, reason: 'storage' };
        }
      }
    }

    window.SynapseAIConversationHistory = Object.freeze({ save, restore, limits });
})();
