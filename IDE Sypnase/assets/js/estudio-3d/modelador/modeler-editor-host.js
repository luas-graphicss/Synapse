'use strict';

function modelerCreateEditorHost(silenceMs) {
  let hostId = '';
  let hostProjectCount = 0;
  let hostLastSeenAt = 0;

  function hostIsSilent(now) {
    return now - hostLastSeenAt > silenceMs;
  }

  function adoptHost(senderId, projectCount, now) {
    hostId = senderId;
    hostProjectCount = projectCount > 0 ? projectCount : 0;
    hostLastSeenAt = now;
  }

  return {
    currentHostId() {
      return hostId;
    },
    markHostAlive(senderId) {
      if (!senderId || senderId !== hostId) return;
      hostLastSeenAt = Date.now();
    },
    forgetHost() {
      hostId = '';
      hostProjectCount = 0;
      hostLastSeenAt = 0;
    },
    acceptsSender(senderId, projectCount) {
      if (!senderId) return true;
      const now = Date.now();
      const count = typeof projectCount === 'number' ? projectCount : -1;
      if (senderId === hostId) {
        hostLastSeenAt = now;
        if (count >= 0) hostProjectCount = count;
        return true;
      }
      const hostIsUseless = count > 0 && hostProjectCount === 0;
      if (!hostId || hostIsSilent(now) || hostIsUseless) {
        adoptHost(senderId, count, now);
        return true;
      }
      return false;
    },
  };
}
