/* Folha de Cálculo — Worker: recebe a folha, calcula e devolve os resultados */
'use strict';
self.onmessage = function (ev) {
  const msg = ev.data;
  if (msg && msg.cmd === 'anim') {
    try {
      const prog = (k, n) => self.postMessage({ type: 'aprogress', job: msg.job, k, n });
      const frames = msg.own ? self.FC.computeOwnFrames(msg.regions, msg.own, msg.values, msg.opts, prog) : self.FC.computeFrames(msg.regions, msg.target, msg.param, msg.values, msg.opts, prog);
      self.postMessage({ type: 'adone', job: msg.job, frames });
    } catch (e) { self.postMessage({ type: 'afail', job: msg.job, err: String((e && e.message) || e) }); }
    return;
  }
  if (msg && msg.cmd === 'packtest') {
    try {
      const v = self.FC.validatePack(msg.pack);
      const t = v.errors.length ? null : self.FC.runPackTests(msg.pack);
      self.postMessage({ type: 'packtest', job: msg.job, validation: v, result: t });
    } catch (e) { self.postMessage({ type: 'packtest', job: msg.job, validation: { errors: [String((e && e.message) || e)], warnings: [] }, result: null }); }
    return;
  }
  if (!msg || msg.cmd !== 'calc') return;
  const t0 = Date.now();
  try {
    const r = self.FC.computeSheet(msg.regions, (i, n) => { self.postMessage({ type: 'progress', job: msg.job, i, n }); }, msg.opts);
    self.postMessage({ type: 'done', job: msg.job, results: r.results, errors: r.errors, warnings: r.warnings, tabCache: r.tabCache, tabFresh: r.tabFresh, ms: Date.now() - t0 });
  } catch (e) {
    self.postMessage({ type: 'fail', job: msg.job, err: String((e && e.message) || e) });
  }
};
self.postMessage({ type: 'ready' });
