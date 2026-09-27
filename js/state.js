/* state.js - central game state + localStorage persistence.
   Progress, orbs and achievements survive page reloads. */
(function () {
  'use strict';

  var KEY = 'cs_world_save_v1';
  var DEFAULTS = {
    stops: [],          // station ids discovered
    orbs: [],           // orb indexes collected
    ach: [],            // achievement ids unlocked
    quests: [],         // quest ids completed
    projectsOpen: [],   // project ids opened
    seasonsSeen: [],    // season names experienced
    nightSeen: false,
    playSec: 0,
    complete: false
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    var d = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          for (var k in DEFAULTS) {
            if (saved[k] !== undefined && saved[k] !== null) d[k] = saved[k];
          }
        }
      }
    } catch (e) { /* corrupted or unavailable storage - start fresh */ }
    return d;
  }

  var S = load();
  var dirty = false;

  function save() {
    dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode etc. */ }
  }
  function mark() {
    dirty = true;
    if (mark._t) return;
    mark._t = setTimeout(function () { mark._t = null; if (dirty) save(); }, 800);
  }

  var State = {
    data: S,

    /* returns true if this was new */
    visitStop: function (id) {
      if (S.stops.indexOf(id) >= 0) return false;
      S.stops.push(id); mark(); return true;
    },
    grabOrb: function (i) {
      if (S.orbs.indexOf(i) >= 0) return false;
      S.orbs.push(i); mark(); return true;
    },
    openProject: function (id) {
      if (S.projectsOpen.indexOf(id) >= 0) return false;
      S.projectsOpen.push(id); mark(); return true;
    },
    seeSeason: function (name) {
      if (S.seasonsSeen.indexOf(name) >= 0) return false;
      S.seasonsSeen.push(name); mark(); return true;
    },
    seeNight: function () {
      if (S.nightSeen) return false;
      S.nightSeen = true; mark(); return true;
    },
    finishQuest: function (id) {
      if (S.quests.indexOf(id) >= 0) return false;
      S.quests.push(id); mark(); return true;
    },
    setComplete: function () {
      if (S.complete) return false;
      S.complete = true; mark(); return true;
    },
    addPlayTime: function (sec) { S.playSec += sec; mark(); },

    /* returns true if newly unlocked */
    unlock: function (achId) {
      if (S.ach.indexOf(achId) >= 0) return false;
      S.ach.push(achId);
      save(); // achievements save immediately
      return true;
    },
    isUnlocked: function (achId) { return S.ach.indexOf(achId) >= 0; },
    hasOrb: function (i) { return S.orbs.indexOf(i) >= 0; },
    orbCount: function () { return S.orbs.length; },
    stopCount: function () { return S.stops.length; },

    saveNow: save,

    reset: function () {
      S = State.data = clone(DEFAULTS);
      try { localStorage.removeItem(KEY); } catch (e) {}
      save();
    }
  };

  /* flush on exit */
  window.addEventListener('beforeunload', function () { save(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  window.STATE = State;
})();
