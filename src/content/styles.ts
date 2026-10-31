import { COLORS, RADII, SHADOWS, TYPE, MOTION } from '../design/tokens';
// Content-script CSS. Every rule is scoped to VISUS-owned nodes
// (.lf-w highlights or .lf-ui roots) so host-site styles cannot leak in
// and VISUS rules cannot leak out. UI roots use pointer-events:auto only
// on themselves; subtitle click-through is preserved.
export const CONTENT_CSS = `
.lf-w{border-radius:6px;cursor:pointer;transition:background ${MOTION.fast}}
.lf-new{background:var(--lf-new,#bfdbfe)}
.lf-l1{background:var(--lf-l1,#fde047)}
.lf-l2{background:var(--lf-l2,#fef08a)}
.lf-l3{background:var(--lf-l3,#fef9c3);text-decoration:underline dotted #ca8a04;text-underline-offset:3px}
.lf-l4{background:transparent;text-decoration:underline dotted #ca8a04;text-underline-offset:3px}
.lf-known,.lf-ignored{background:transparent}
.lf-w:hover{filter:brightness(.94)}
.lf-w:focus-visible,#lf-panel button:focus-visible,#lf-counter:focus-visible,#lf-sidebar button:focus-visible,#lf-sidebar select:focus-visible,#lf-sidebar input:focus-visible{outline:2px solid ${COLORS.petrol};outline-offset:2px}
@keyframes lf-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes lf-fadein{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){#lf-panel,#lf-tooltip,#lf-sidebar,#lf-counter{animation:none!important;transition:none!important}}
#lf-tooltip{position:fixed;z-index:2147483646;max-width:300px;background:${COLORS.charcoal};color:${COLORS.paper};border:1px solid rgba(244,236,219,.22);border-radius:${RADII.card}px;padding:12px 14px;font:13px/1.5 ${TYPE.sans};box-shadow:${SHADOWS.panel};pointer-events:none;animation:lf-fadein ${MOTION.fast}}
#lf-tooltip .lf-tt-word{font-weight:700;font-size:16px;font-family:${TYPE.serif}}
#lf-tooltip .lf-tt-phon{color:#cbb894}
#lf-panel{position:fixed;z-index:2147483647;width:340px;max-width:92vw;max-height:min(78vh,640px);overflow:auto;background:${COLORS.charcoal};color:${COLORS.paper};border:1px solid rgba(244,236,219,.20);border-radius:${RADII.popup}px;box-shadow:${SHADOWS.panel};padding:18px;font:14px/1.55 ${TYPE.sans};animation:lf-pop ${MOTION.fast}}
#lf-panel h3{margin:0 0 2px;font-size:24px;font-family:${TYPE.serif};font-weight:600}
#lf-panel .lf-grades{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:12px}
#lf-panel button{border:1px solid ${COLORS.sandDark};background:rgba(255,250,240,.06);color:inherit;border-radius:${RADII.button}px;padding:7px 4px;cursor:pointer;font-size:12px;letter-spacing:.03em;transition:background ${MOTION.fast},color ${MOTION.fast}}
#lf-panel button:hover{background:${COLORS.terracotta};color:#fff7ea;border-color:${COLORS.terracotta}}
#lf-panel input{background:rgba(255,250,240,.07);border:1px solid ${COLORS.sandDark};border-radius:${RADII.button}px;color:inherit;padding:7px 10px}
#lf-panel .lf-row{display:flex;gap:6px;margin-top:10px}
#lf-panel .lf-row button{flex:1}
#lf-counter{position:fixed;z-index:2147483645;display:flex;align-items:center;gap:8px;background:rgba(43,37,29,.96);color:${COLORS.paper};border:1px solid rgba(244,236,219,.24);border-radius:${RADII.pill}px;padding:8px 12px;font:12px ${TYPE.sans};box-shadow:${SHADOWS.pill};cursor:grab;user-select:none;touch-action:none;animation:lf-fadein ${MOTION.fast}}
#lf-counter .lf-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
#lf-counter button{border:0;background:transparent;color:#cbb894;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:999px}
#lf-counter[data-collapsed="1"] .lf-counts,#lf-counter[data-collapsed="1"] .lf-chev{display:none}
#lf-counter[data-hidden="1"]{width:30px;height:30px;padding:0;justify-content:center;border-radius:50%}
#lf-counter[data-hidden="1"] .lf-counts,#lf-counter[data-hidden="1"] button{display:none}
#lf-subtitles{position:absolute;left:50%;transform:translateX(-50%);bottom:12%;z-index:60;text-align:center;pointer-events:none;width:min(88%,900px)}
#lf-subtitles .lf-sub-line{background:rgba(43,37,29,.84);color:${COLORS.paper};border-radius:14px;padding:9px 16px;display:inline-block;pointer-events:auto;box-shadow:${SHADOWS.card}}
#lf-subtitles .lf-sub-tr{color:#e8c9a0;font-size:.82em;margin-top:4px}
#lf-subtitles .lf-blur .lf-sub-line{filter:blur(6px)}
#lf-subtitles .lf-blur .lf-sub-line:hover{filter:none}
#lf-sidebar{position:fixed;top:76px;right:16px;z-index:2147483644;width:340px;max-width:94vw;max-height:calc(100vh - 100px);overflow:auto;background:${COLORS.charcoal};color:${COLORS.paper};border:1px solid rgba(244,236,219,.20);border-radius:${RADII.sidebar}px;box-shadow:${SHADOWS.panel};padding:16px;font:13px/1.55 ${TYPE.sans};animation:lf-pop ${MOTION.fast}}
#lf-sidebar h4{margin:0;font-family:${TYPE.serif};font-size:17px;font-weight:600}
#lf-sidebar .lf-side-sec{border-top:1px solid rgba(244,236,219,.14);padding-top:10px;margin-top:10px}
#lf-sidebar .lf-side-cur{font-size:16px;line-height:1.5}
#lf-sidebar .lf-side-tr{color:#e8c9a0;margin-top:4px}
#lf-sidebar .lf-side-hist{max-height:150px;overflow:auto;display:grid;gap:2px}
#lf-sidebar .lf-side-hist button{text-align:left;border:0;background:transparent;color:#d8cbb2;cursor:pointer;padding:5px 7px;border-radius:9px;font-size:12px}
#lf-sidebar .lf-side-hist button:hover,#lf-sidebar .lf-side-hist button[data-on="1"]{background:rgba(255,250,240,.09);color:#fff7ea}
#lf-sidebar .lf-side-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
#lf-sidebar button.lf-ctl{border:1px solid ${COLORS.sandDark};background:rgba(255,250,240,.06);color:inherit;border-radius:${RADII.button}px;padding:6px 10px;cursor:pointer;font-size:12px}
#lf-sidebar button.lf-ctl:hover{background:${COLORS.terracotta};color:#fff7ea}
#lf-sidebar select,#lf-sidebar input[type="text"]{background:rgba(255,250,240,.07);border:1px solid ${COLORS.sandDark};border-radius:${RADII.button}px;color:inherit;padding:6px 8px;font-size:12px}
#lf-sidebar .lf-resize{position:absolute;left:6px;top:0;bottom:0;width:10px;cursor:ew-resize}
#lf-sidebar[data-collapsed="1"] .lf-side-body{display:none}
#lf-sidebar .lf-badge{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;background:rgba(255,250,240,.10);color:#e8c9a0}
@media (prefers-color-scheme:light){#lf-sidebar{box-shadow:${SHADOWS.panel}}}
`;
