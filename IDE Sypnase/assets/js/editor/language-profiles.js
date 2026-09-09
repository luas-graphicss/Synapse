(function () {
    'use strict';

    const codeQuotes = ['"', "'"];
    const slashComments = { lineComments: ['//'], blockComments: [['/*', '*/']] };

    const baseProfile = {
      id: 'text',
      lineComments: [],
      blockComments: [],
      quotes: [],
      escapeCharacter: '\\',
      memberOperators: ['.'],
      wordPattern: /[\w$]/,
    };

    function createProfile(id, settings) {
      return Object.freeze({ ...baseProfile, id, ...settings });
    }

    const profiles = Object.freeze({
        text: createProfile('text', {}),
        csharp: createProfile('csharp', { ...slashComments, quotes: codeQuotes }),
        luau: createProfile('luau', {
            lineComments: ['--'],
            blockComments: [['--[[', ']]']],
            quotes: codeQuotes,
            memberOperators: ['.', ':'],
        }),
        python: createProfile('python', {
            lineComments: ['#'],
            blockComments: [
              ['"""', '"""'],
              ["'''", "'''"],
            ],
            quotes: codeQuotes,
        }),
        java: createProfile('java', { ...slashComments, quotes: codeQuotes }),
        kotlin: createProfile('kotlin', { ...slashComments, quotes: codeQuotes }),
        swift: createProfile('swift', { ...slashComments, quotes: codeQuotes }),
        cpp: createProfile('cpp', { ...slashComments, quotes: codeQuotes }),
        go: createProfile('go', { ...slashComments, quotes: codeQuotes }),
        rust: createProfile('rust', { ...slashComments, quotes: codeQuotes }),
        dart: createProfile('dart', { ...slashComments, quotes: codeQuotes }),
        php: createProfile('php', {
            lineComments: ['//', '#'],
            blockComments: [['/*', '*/']],
            quotes: codeQuotes,
        }),
        ruby: createProfile('ruby', { lineComments: ['#'], quotes: codeQuotes }),
        sql: createProfile('sql', {
            lineComments: ['--'],
            blockComments: [['/*', '*/']],
            quotes: codeQuotes,
        }),
        shell: createProfile('shell', { lineComments: ['#'], quotes: codeQuotes }),
        powershell: createProfile('powershell', { lineComments: ['#'], quotes: codeQuotes }),
        yaml: createProfile('yaml', { lineComments: ['#'], quotes: codeQuotes }),
        ini: createProfile('ini', { lineComments: ['#', ';'], quotes: codeQuotes }),
        markdown: createProfile('markdown', {}),
    });

    const profileByExtension = Object.freeze({
        cs: 'csharp',
        csx: 'csharp',
        lua: 'luau',
        luau: 'luau',
        rbxlua: 'luau',
        py: 'python',
        pyw: 'python',
        java: 'java',
        kt: 'kotlin',
        kts: 'kotlin',
        swift: 'swift',
        c: 'cpp',
        h: 'cpp',
        cpp: 'cpp',
        cc: 'cpp',
        cxx: 'cpp',
        hpp: 'cpp',
        hh: 'cpp',
        go: 'go',
        rs: 'rust',
        dart: 'dart',
        php: 'php',
        rb: 'ruby',
        sql: 'sql',
        sh: 'shell',
        bash: 'shell',
        zsh: 'shell',
        ps1: 'powershell',
        yml: 'yaml',
        yaml: 'yaml',
        toml: 'ini',
        ini: 'ini',
        cfg: 'ini',
        conf: 'ini',
        env: 'ini',
        md: 'markdown',
        markdown: 'markdown',
        txt: 'text',
        log: 'text',
    });

    function fromPath(path) {
      const filename = String(path || '')
      .split(/[\\/]/)
      .pop()
      .toLowerCase();
      const extension = filename.includes('.')
      ? filename.slice(filename.lastIndexOf('.') + 1)
      : filename;
      return profiles[profileByExtension[extension]] || profiles.text;
    }

    window.SynapseLanguageProfiles = Object.freeze({ fromPath, profiles });
})();
