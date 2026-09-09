(function () {
    'use strict';

    const debug = window.SynapseDebug;

    function launchCommand(path) {
      if (!debug.paths.isJavaScript(path))
      throw new Error('Select a JavaScript entry (.js, .mjs or .cjs).');
      const encoded = btoa(
        Array.from(new TextEncoder().encode(path), (byte) => String.fromCharCode(byte)).join(''),
      );
      const source = `const child=require('node:child_process').spawn(process.execPath,['--inspect-brk=127.0.0.1:0','--enable-source-maps','--',Buffer.from('${encoded}','base64').toString('utf8')],{stdio:'inherit'});child.on('error',error=>{process.stderr.write(String(error));process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1})`;
      return `node -e "${source}"`;
    }

    class NodeLauncher {
      constructor(host) {
        this.host = host;
        this.record = null;
      }

      async start(project, entry) {
        if (this.record) throw new Error('A debug process is already active.');
        const command = launchCommand(entry);
        if (typeof project?.files.get(entry)?.text !== 'string')
        throw new Error('The selected entry is missing or is not a text file.');
        this.host.assertAvailable(command);
        const record = { project, command, processId: null, offset: 0, cancelled: false, output: '' };
        this.record = record;
        this.host.reserve();
        try {
          const synchronized = await this.host.sync(project);
          if (synchronized.locked?.length)
          throw new Error(
            'Some sources could not be synchronized. Close the files using them and try again.',
          );
          if (record.cancelled) throw new Error('Debug launch cancelled.');
          this.host.assertPermission(command);
          const result = await this.host.api('run', {
              project: this.host.projectName(project),
              command,
          });
          if (result.reused)
          throw new Error(
            'This debug command is already running. Stop it in the terminal before starting a new session.',
          );
          record.processId = result.procId;
          if (!record.processId) throw new Error('The relay did not return a debug process.');
          this.host.started(record);
          if (record.cancelled) throw new Error('Debug launch cancelled.');
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline && !record.cancelled) {
            const output = await this.readOutput(record);
            const endpoint = /Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/.exec(
              record.output,
            )?.[1];
            if (endpoint)
            return {
              endpoint: debug.paths.inspectorEndpoint(endpoint),
              root: synchronized.dir || result.dir,
            };
            if (output.done)
            throw new Error(record.output || 'Node exited before Inspector became available.');
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          throw new Error(
            record.cancelled
            ? 'Debug launch cancelled.'
            : 'Inspector did not start within 15 seconds. Check Node and the relay.',
          );
        } catch (error) {
          await this.stop().catch((cleanupError) => this.host.onError(cleanupError));
          if (!record.processId) await this.finish(record);
          throw error;
        }
      }

      async readOutput(record) {
        const result = await this.host.api('out', {
            procId: record.processId,
            from: record.offset,
            wait: 1000,
        });
        record.offset = result.next ?? record.offset;
        if (result.text) {
          record.output = (record.output + result.text).slice(-20000);
          const visible = result.text
          .replace(/^Debugger listening on .*$/gm, '')
          .replace(/^For help, see: .*$/gm, '')
          .trim();
          if (visible) this.host.onOutput(visible);
        }
        return result;
      }

      async monitor(onComplete) {
        const record = this.record;
        if (!record?.processId) return;
        try {
          while (this.record === record && !record.cancelled) {
            const result = await this.readOutput(record);
            if (result.done || record.output.includes('Waiting for the debugger to disconnect...')) {
              await onComplete();
              if (!result.done) {
                await this.host.api('out', {
                    procId: record.processId,
                    from: record.offset,
                    wait: 2000,
                    fim: true,
                });
              }
              await this.finish(record);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        } catch (error) {
          if (this.record === record && !record.cancelled) {
            this.host.onError(error);
            await this.stop().catch((cleanupError) => this.host.onError(cleanupError));
          }
        }
      }

      async finish(record) {
        if (this.record !== record) return;
        this.record = null;
        this.host.release(record);
        await this.host.finished(record);
      }

      async stop() {
        const record = this.record;
        if (!record) return;
        record.cancelled = true;
        if (!record.processId) return;
        await this.host.api('kill', { procId: record.processId });
        await this.finish(record);
      }
    }

    debug.NodeLauncher = NodeLauncher;
    debug.launchCommand = launchCommand;
})();
