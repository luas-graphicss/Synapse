const TOUR_STYLE_SHEET = [
  '.tour-root{position:fixed;inset:0;z-index:6000;font-family:var(--sans);color:#e7ebf0}',
  '.tour-veil{position:fixed;background:rgba(10,12,15,.74);-webkit-backdrop-filter:blur(3px) ' +
  'saturate(.35);backdrop-filter:blur(3px) saturate(.35);transition:top .45s ' +
  'cubic-bezier(.22,.8,.2,1),left .45s cubic-bezier(.22,.8,.2,1),width .45s ' +
  'cubic-bezier(.22,.8,.2,1),height .45s cubic-bezier(.22,.8,.2,1),opacity .3s}',
  '.tour-hole{position:fixed;cursor:pointer;background:transparent}',
  '.tour-ring{position:fixed;border-radius:8px;pointer-events:none;transition:all .45s ' +
  'cubic-bezier(.22,.8,.2,1);box-shadow:0 0 0 1px rgba(226,232,240,.7),0 0 0 5px ' +
  'rgba(148,163,184,.1)}',
  '.tour-ring i{position:absolute;width:9px;height:9px;border:1px solid rgba(226,232,240,.6);animation:tourFade .3s ease both}',
  '.tour-ring i:nth-child(1){top:-4px;left:-4px;border-right:0;border-bottom:0}',
  '.tour-ring i:nth-child(2){top:-4px;right:-4px;border-left:0;border-bottom:0}',
  '.tour-ring i:nth-child(3){bottom:-4px;right:-4px;border-left:0;border-top:0}',
  '.tour-ring i:nth-child(4){bottom:-4px;left:-4px;border-right:0;border-top:0}',
  '.tour-card{position:fixed;width:min(392px,calc(100vw - 26px));background:#101317;' +
  'border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:15px 16px 12px;' +
  'box-shadow:0 18px 48px rgba(0,0,0,.55);transition:top .45s cubic-bezier(.22,.8,.2,1),' +
  'left .45s cubic-bezier(.22,.8,.2,1);overflow:hidden}',
  '.tour-card.troca{animation:tourCard .32s ease both}',
  '.tour-kick{display:block;font:600 9.5px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:#7c8797;margin-bottom:8px}',
  '.tour-h{font-size:15.5px;font-weight:600;letter-spacing:-.01em;line-height:1.3;margin:0 0 6px;color:#eef2f6}',
  '.tour-p{font-size:12.5px;line-height:1.62;color:#98a2b0;min-height:58px}',
  ".tour-p::after{content:'';display:inline-block;width:1px;height:12px;margin-left:3px;vertical-align:-2px;background:#8b95a4;animation:tourCaret .9s steps(1) infinite}",
  '.tour-card.pronto .tour-p::after{display:none}',
  '.tour-keys{display:flex;gap:5px;margin-top:9px;flex-wrap:wrap}',
  '.tour-key{font:600 10.5px/1 var(--mono);padding:5px 7px;border-radius:4px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.2);color:#aab3c0}',
  '.tour-foot{display:flex;align-items:center;gap:10px;margin-top:13px}',
  '.tour-n{font:600 10.5px var(--mono);color:#6f7a89;flex:none;letter-spacing:.06em}',
  '.tour-prog{flex:1;height:1px;background:rgba(148,163,184,.18);overflow:hidden}',
  '.tour-prog i{display:block;height:100%;width:0;background:#c8d1dc;transition:width .45s cubic-bezier(.22,.8,.2,1)}',
  '.tour-b{display:inline-flex;align-items:center;gap:7px;height:31px;padding:0 13px;' +
  'border-radius:7px;font-weight:600;font-size:12px;border:1px solid rgba(148,163,184,.22);' +
  'background:transparent;color:#d7dee7;cursor:pointer;transition:background .18s,' +
  'border-color .18s,color .18s}',
  '.tour-b:hover{border-color:rgba(226,232,240,.5);background:rgba(148,163,184,.1)}',
  '.tour-b.primary{background:#e3e9f0;border-color:#e3e9f0;color:#0e1116}',
  '.tour-b.primary:hover{background:#fff;border-color:#fff}',
  '.tour-skip{position:absolute;top:12px;right:12px;font:500 10.5px var(--mono);letter-spacing:.04em;color:#6f7a89;background:none;border:0;cursor:pointer;padding:4px 6px;border-radius:5px}',
  '.tour-skip:hover{color:#d7dee7}',
  '.tour-cursor{position:fixed;top:0;left:0;width:20px;height:20px;margin:-2px 0 0 -2px;' +
  'pointer-events:none;opacity:0;transition:transform .7s cubic-bezier(.35,0,.2,1),opacity ' +
  '.25s;z-index:6030;filter:drop-shadow(0 2px 6px rgba(0,0,0,.55))}',
  '.tour-ripple{position:fixed;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;' +
  'border:1px solid rgba(226,232,240,.7);pointer-events:none;z-index:6029;' +
  'animation:tourRipple .7s cubic-bezier(.2,.8,.2,1) forwards}',
  '.tour-full{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;' +
  'justify-content:center;text-align:center;padding:28px;background:rgba(10,12,15,.94);' +
  '-webkit-backdrop-filter:blur(6px) saturate(.35);backdrop-filter:blur(6px) saturate(.35);' +
  'animation:tourFade .35s ease both}',
  '.tour-mark{width:38px;height:38px;border-radius:9px;overflow:hidden;filter:grayscale(1) brightness(1.06);opacity:.88;animation:tourUp .45s both}',
  '.tour-mark svg{display:block;width:100%;height:100%}',
  '.tour-eyebrow{display:inline-flex;align-items:center;gap:10px;margin-top:18px;font:600 ' +
  '9.5px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;color:#7c8797;' +
  'animation:tourUp .45s .04s both}',
  ".tour-eyebrow::before,.tour-eyebrow::after{content:'';width:18px;height:1px;background:rgba(148,163,184,.28)}",
  '.tour-t1{font-size:min(6.4vw,30px);font-weight:600;letter-spacing:-.02em;line-height:1.18;color:#eef2f6;margin:12px 0 0;animation:tourUp .45s .08s both}',
  '.tour-t2{font-size:13px;color:#98a2b0;max-width:470px;line-height:1.66;margin:10px 0 0;animation:tourUp .45s .14s both}',
  '.tour-acts{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;margin-top:22px;animation:tourUp .45s .2s both}',
  '.tour-rule{width:min(420px,72vw);height:1px;background:rgba(148,163,184,.18);margin-top:22px;animation:tourUp .45s .22s both}',
  '.tour-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 32px;margin-top:16px;text-align:left;max-width:470px}',
  '.tour-li{display:flex;align-items:center;gap:9px;font-size:12px;color:#98a2b0;animation:tourUp .4s both}',
  '.tour-li svg{width:12px;height:12px;flex:none;color:#6f7a89}',
  '.tour-invite{align-items:flex-start!important;cursor:default!important;max-width:340px!important;border-left-color:rgba(148,163,184,.55)!important}',
  '.tour-invite .toast-bar{display:none}',
  '.tour-invite .tx b{margin-bottom:2px}',
  '.ti-acts{display:flex;gap:7px;margin-top:11px}',
  '.ti-b{height:28px;padding:0 11px;border-radius:6px;font-weight:600;font-size:11.5px;' +
  'cursor:pointer;border:1px solid rgba(148,163,184,.22);background:transparent;' +
  'color:#d7dee7;transition:background .18s,border-color .18s}',
  '.ti-b:hover{border-color:rgba(226,232,240,.5);background:rgba(148,163,184,.1)}',
  '.ti-b.primary{background:#e3e9f0;border-color:#e3e9f0;color:#0e1116}',
  '.tour-btn{position:relative}',
  '.tour-btn .tour-dot{display:none;position:absolute;top:-1px;right:-1px;width:6px;height:6px;border-radius:50%;background:#c8d1dc;box-shadow:0 0 0 2px var(--bg-1)}',
  '.tour-btn.novo .tour-dot{display:block;animation:tourPulse 2.4s ease-in-out infinite}',
  'body.tour-ativo .toasts{opacity:0;pointer-events:none}',
  '@keyframes tourCard{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
  '@keyframes tourCaret{0%,49%{opacity:1}50%,100%{opacity:0}}',
  '@keyframes tourRipple{from{opacity:.8;transform:scale(.5)}to{opacity:0;transform:scale(3)}}',
  '@keyframes tourFade{from{opacity:0}to{opacity:1}}',
  '@keyframes tourUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
  '@keyframes tourPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.5}}',
  '@media (max-width:760px){.tour-card{width:calc(100vw - 20px);left:10px!important}.tour-t1{font-size:24px}.tour-cols{grid-template-columns:1fr;gap:8px}}',
  '@media (prefers-reduced-motion:reduce){.tour-t1,.tour-card.troca,.tour-mark,.tour-eyebrow,' +
  '.tour-li,.tour-rule{animation:none!important}.tour-veil,.tour-ring,.tour-card,' +
  '.tour-cursor{transition:none!important}.tour-p::after{display:none}}',
].join('\n');
