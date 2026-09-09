(function () {
    'use strict';

    const debug = window.SynapseDebug;
    const controlMethods = Object.freeze({
        resume: 'Debugger.resume',
        pause: 'Debugger.pause',
        stepOver: 'Debugger.stepOver',
        stepInto: 'Debugger.stepInto',
        stepOut: 'Debugger.stepOut',
    });

    class DebugSession {
      constructor(options = {}) {
        this.options = options;
        this.state = 'idle';
        this.frames = [];
        this.scripts = new Map();
        this.verifiedSources = new Map();
        this.breakpoints = new Map();
        this.pauseRevision = 0;
        this.sourceRevision = 0;
        this.selectedFrame = 0;
        this.generation = 0;
        this.breakpointQueue = Promise.resolve();
        this.message = '';
        this.busy = false;
        this.pauseRequested = false;
      }

      emit() {
        this.options.onChange?.(this.snapshot());
      }

      snapshot() {
        return {
          state: this.state,
          message: this.message,
          frames: this.frames,
          selectedFrame: this.selectedFrame,
          pauseRevision: this.pauseRevision,
          reason: this.reason || '',
          busy: this.busy,
          breakpoints: Array.from(this.breakpoints.values()),
          projectId: this.project?.id,
        };
      }

      clearExecutionState() {
        this.frames = [];
        this.scripts.clear();
        this.verifiedSources.clear();
        this.sourceRevision++;
        this.pauseRevision++;
        this.selectedFrame = 0;
        this.reason = '';
        this.busy = false;
        this.pauseRequested = false;
      }

      isCurrentConnection(connection, generation) {
        return (
          !!connection &&
          this.connection === connection &&
          !connection.closed &&
          generation === this.generation
        );
      }

      async connect({ endpoint, root, project, waitForDebugger = false }) {
        if (this.connection && !this.connection.closed)
        throw new Error('Disconnect the current debug session first.');
        this.root = debug.paths.sourceRoot(root);
        debug.paths.inspectorEndpoint(endpoint);
        this.project = project;
        this.sourceSnapshot = new Map(Array.from(project.files, ([path, file]) => [path, file.text]));
        this.state = 'connecting';
        this.clearExecutionState();
        this.breakpoints.clear();
        this.breakpointQueue = Promise.resolve();
        this.message = '';
        const generation = ++this.generation;
        this.emit();
        const connection = new debug.InspectorConnection(endpoint, {
            ...this.options.connectionOptions,
            onEvent: (method, params) => {
              if (generation === this.generation) this.handleEvent(method, params);
            },
            onClose: (error) => {
              if (generation !== this.generation) return;
              this.state = 'disconnected';
              this.breakpoints.clear();
              this.message = error.message;
              this.clearExecutionState();
              this.sourceSnapshot.clear();
              this.breakpointQueue = Promise.resolve();
              this.emit();
            },
        });
        this.connection = connection;
        try {
          await connection.connect();
          const identity = await connection.request('Runtime.evaluate', {
              expression: 'typeof window !== "undefined" && !!window.SynapseDebugger',
              returnByValue: true,
              throwOnSideEffect: true,
              timeout: 200,
          });
          if (identity.result?.value === true)
          throw new Error(
            'Do not attach the debugger to the IDE itself. Choose a separate target.',
          );
          await connection.request('Runtime.enable');
          await connection.request('Debugger.enable', { maxScriptsCacheSize: 10000000 });
          await connection.request('Debugger.setPauseOnExceptions', { state: 'none' });
          await this.syncBreakpoints(debug.preferences.forProject(project).breakpoints);
          if (generation !== this.generation) throw new Error('Debug session cancelled.');
          if (this.state === 'connecting') this.state = 'running';
          if (waitForDebugger) await connection.request('Runtime.runIfWaitingForDebugger');
          this.emit();
        } catch (error) {
          if (generation === this.generation) {
            connection.close();
            this.message = error.message;
            this.state = 'error';
            this.emit();
          }
          throw error;
        }
      }

      handleEvent(method, params) {
        if (method === 'Debugger.scriptParsed') {
          if (this.scripts.has(params.scriptId)) this.sourceRevision++;
          this.verifiedSources.delete(params.scriptId);
          this.scripts.set(params.scriptId, params);
          return;
        }
        if (method === 'Debugger.breakpointResolved') {
          for (const breakpoint of this.breakpoints.values()) {
            if (breakpoint.id === params.breakpointId) {
              breakpoint.locations = [
                ...breakpoint.locations.filter(
                  (location) => location.scriptId !== params.location.scriptId,
                ),
                params.location,
              ];
            }
          }
          this.emit();
          return;
        }
        if (method === 'Debugger.paused') {
          this.pauseRevision++;
          this.state = 'paused';
          this.reason = params.reason || 'other';
          this.message = '';
          this.busy = false;
          this.pauseRequested = false;
          this.frames = (params.callFrames || []).map((frame) => {
              const script = this.scripts.get(frame.location.scriptId);
              const url = frame.url || script?.url || '';
              return {
                ...frame,
                url,
                path: debug.paths.relativeSource(this.root, url, this.project.files),
                line: frame.location.lineNumber + 1,
                column: frame.location.columnNumber + 1,
              };
          });
          this.selectedFrame = 0;
          this.emit();
          return;
        }
        if (method === 'Debugger.resumed') {
          this.pauseRevision++;
          this.state = 'running';
          this.frames = [];
          this.busy = false;
          this.pauseRequested = false;
          this.emit();
          return;
        }
        if (method === 'Runtime.executionContextsCleared') {
          this.clearExecutionState();
          if (this.state === 'paused') this.state = 'running';
          for (const breakpoint of this.breakpoints.values()) breakpoint.locations = [];
          this.emit();
          return;
        }
        if (method === 'Runtime.consoleAPICalled') {
          this.options.onOutput?.(
            params.type,
            (params.args || []).map(debug.inspection.describe).join(' '),
          );
        }
        if (method === 'Runtime.exceptionThrown') {
          const details = params.exceptionDetails || {};
          this.options.onOutput?.(
            'error',
            details.exception?.description || details.text || 'Runtime exception',
          );
        }
      }

      breakpointSourceError(path) {
        if (typeof this.project?.files.get(path)?.text !== 'string') return 'Source file is missing.';
        if (this.sourceChanged(path)) return 'Source changed. Restart debugging.';
        return '';
      }

      syncBreakpoints(entries) {
        const desired = debug.preferences
        .sanitize({ breakpoints: entries })
        .breakpoints.filter((entry) => entry.enabled);
        const connection = this.connection;
        const generation = this.generation;
        const isCurrent = () => this.isCurrentConnection(connection, generation);
        const synchronize = async () => {
          if (!isCurrent()) return;
          const keys = new Set(desired.map(debug.paths.breakpointKey));
          for (const [key, breakpoint] of this.breakpoints) {
            if (!isCurrent()) return;
            if (keys.has(key) && breakpoint.id && !this.breakpointSourceError(breakpoint.path))
            continue;
            if (breakpoint.id)
            await connection.request('Debugger.removeBreakpoint', { breakpointId: breakpoint.id });
            if (!isCurrent()) return;
            this.breakpoints.delete(key);
          }
          for (const entry of desired) {
            if (!isCurrent()) return;
            const key = debug.paths.breakpointKey(entry);
            if (this.breakpoints.has(key)) continue;
            const breakpoint = {
              ...entry,
              id: null,
              locations: [],
              error: this.breakpointSourceError(entry.path),
            };
            this.breakpoints.set(key, breakpoint);
            if (breakpoint.error) continue;
            try {
              const result = await connection.request('Debugger.setBreakpointByUrl', {
                  urlRegex: debug.paths.breakpointPattern(this.root, entry.path),
                  lineNumber: entry.line - 1,
                  columnNumber: 0,
              });
              if (!isCurrent()) return;
              breakpoint.id = result.breakpointId;
              breakpoint.locations = result.locations || [];
            } catch (error) {
              if (!isCurrent()) return;
              breakpoint.error = error.message;
            }
          }
          if (isCurrent()) this.emit();
        };
        this.breakpointQueue = this.breakpointQueue
        .catch((error) => {
            if (isCurrent()) this.options.onOutput?.('error', error.message);
        })
        .then(synchronize);
        return this.breakpointQueue;
      }

      async verifySource(frame) {
        if (!frame?.path || this.sourceChanged(frame.path)) return false;
        const scriptId = frame.location.scriptId;
        if (this.verifiedSources.has(scriptId)) return this.verifiedSources.get(scriptId);
        const connection = this.connection;
        const generation = this.generation;
        const sourceRevision = this.sourceRevision;
        if (!this.isCurrentConnection(connection, generation)) return false;
        const response = await connection.request('Debugger.getScriptSource', { scriptId });
        if (
          !this.isCurrentConnection(connection, generation) ||
          sourceRevision !== this.sourceRevision ||
          this.sourceChanged(frame.path)
        )
        return false;
        const expected = String(this.sourceSnapshot.get(frame.path) ?? '').replace(/\r\n?/g, '\n');
        const received = String(response.scriptSource ?? '').replace(/\r\n?/g, '\n');
        const verified = received === expected;
        this.verifiedSources.set(scriptId, verified);
        return verified;
      }

      sourceChanged(path) {
        return (
          !this.sourceSnapshot?.has(path) ||
          this.sourceSnapshot.get(path) !== this.project?.files.get(path)?.text
        );
      }

      selectFrame(index) {
        if (
          this.state !== 'paused' ||
          !Number.isInteger(index) ||
          !this.frames[index] ||
          index === this.selectedFrame
        )
        return;
        this.selectedFrame = index;
        this.pauseRevision++;
        this.emit();
      }

      async control(action) {
        if (!controlMethods[action]) throw new Error('Unknown debug command.');
        const requiredState = action === 'pause' ? 'running' : 'paused';
        if (
          this.state !== requiredState ||
          this.busy ||
          (action === 'pause' && this.pauseRequested)
        )
        return false;
        this.busy = true;
        this.pauseRequested = action === 'pause';
        const connection = this.connection;
        const generation = this.generation;
        const previousFrames = this.frames;
        const previousSelection = this.selectedFrame;
        const revision = ++this.pauseRevision;
        if (action !== 'pause') {
          this.state = 'running';
          this.frames = [];
        }
        this.emit();
        try {
          await this.breakpointQueue;
          if (!this.isCurrentConnection(connection, generation) || revision !== this.pauseRevision)
          return false;
          await connection.request(controlMethods[action]);
          return true;
        } catch (error) {
          if (generation === this.generation && revision === this.pauseRevision) {
            this.pauseRequested = false;
            this.state = requiredState;
            this.frames = previousFrames;
            this.selectedFrame = previousSelection;
            this.message = error.message;
          }
          throw error;
        } finally {
          if (generation === this.generation && revision === this.pauseRevision) this.busy = false;
          this.emit();
        }
      }

      async disconnect() {
        const connection = this.connection;
        ++this.generation;
        this.connection = null;
        this.clearExecutionState();
        this.sourceSnapshot?.clear();
        this.breakpoints.clear();
        this.breakpointQueue = Promise.resolve();
        this.state = 'idle';
        this.message = '';
        try {
          if (connection?.opened && !connection.closed) await connection.request('Debugger.disable');
        } finally {
          connection?.close();
          this.emit();
        }
      }
    }

    debug.DebugSession = DebugSession;
})();
