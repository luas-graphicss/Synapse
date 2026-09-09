(function (root) {
    'use strict';

    const SESSION_DATABASE_NAME = 'aurora-lp';
    const SESSION_OWNER_CHANNEL_NAME = 'aurora.session.owner';
    const SESSION_OWNER_STORAGE_KEY = 'aurora.session.owner';
    const SESSION_WRITER_LOCK_NAME = 'aurora.session.writer';

    function scopedName(baseName) {
      const namespace = root.SynapseInstanceNamespace;
      return namespace ? namespace.scopedName(baseName) : baseName;
    }

    function databaseName() {
      return scopedName(SESSION_DATABASE_NAME);
    }

    function ownerChannelName() {
      return scopedName(SESSION_OWNER_CHANNEL_NAME);
    }

    function ownerStorageKey() {
      return scopedName(SESSION_OWNER_STORAGE_KEY);
    }

    function writerLockName() {
      return scopedName(SESSION_WRITER_LOCK_NAME);
    }

    function preservedDatabaseNames() {
      const names = [SESSION_DATABASE_NAME, databaseName()];
      return names.filter(function (name, index) {
          return names.indexOf(name) === index;
      });
    }

    root.SynapseSessionStorageNames = {
      databaseName: databaseName,
      ownerChannelName: ownerChannelName,
      ownerStorageKey: ownerStorageKey,
      writerLockName: writerLockName,
      preservedDatabaseNames: preservedDatabaseNames,
    };
})(window);
