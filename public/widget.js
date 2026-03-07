(function () {
  const script = document.currentScript;
  if (!script) return;

  const businessId = script.getAttribute('data-business') || 'demo_barber';
  const position   = script.getAttribute('data-position') || 'bottom-right';
  const accent     = script.getAttribute('data-accent')   || '#10B981';
  const iconAttr   = script.getAttribute('data-icon')     || '';
  const greeting   = script.getAttribute('data-greeting') || 'Hi! How can I help you today?';
  const consent    = script.getAttribute('data-consent')  || '';
  const apiBase    = new URL(script.src, window.location.href).origin;

  const SCISSORS_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
  const AVATAR_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
  const launcherIcon = (iconAttr && iconAttr !== 'scissors') ? iconAttr : SCISSORS_SVG;
  const avatarIcon   = (iconAttr && iconAttr !== 'scissors') ? iconAttr : AVATAR_SVG;

  const sessionKey = `ai_receptionist_session_${businessId}`;
  const sessionId  = localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, sessionId);

  let widgetConfig = {
    name: 'Book an Appointment',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    bookingMode: 'calendar',
    services: [{ name: 'Classic Haircut', durationMin: 30 }, { name: 'Skin Fade', durationMin: 45 }, { name: 'Beard Trim', durationMin: 20 }],
    contactPhone: '',
    contactAddress: ''
  };
  let widgetToken = '';

  const bookingKey = `ai_receptionist_booking_${businessId}_${sessionId}`;
  const blankBooking = { active: false, step: 'service', serviceName: '', dateISO: '', selectedSlotISO: '', customerName: '', customerEmail: '', customerPhone: '', slots: [], timezone: '' };
  let booking = (() => { try { const r = localStorage.getItem(bookingKey); return r ? { ...blankBooking, ...JSON.parse(r) } : { ...blankBooking }; } catch { return { ...blankBooking }; } })();
  function saveBooking() { localStorage.setItem(bookingKey, JSON.stringify(booking)); }
  function resetBooking() { booking = { ...blankBooking }; saveBooking(); }

  const el = tag => document.createElement(tag);

  // ── DOM scaffold ──────────────────────────────────────────────────────────────
  const root = el('div');
  root.style.cssText = `position:fixed;z-index:2147483000;${position.includes('bottom') ? 'bottom:20px' : 'top:20px'};${position.includes('right') ? 'right:20px' : 'left:20px'}`;
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: 'open' });

  const posRight  = position.includes('right');
  const posBottom = position.includes('bottom');

  const style = el('style');
  style.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    .bubble{width:58px;height:58px;border-radius:50%;background:${accent};color:#fff;border:0;cursor:pointer;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.28);transition:transform .18s,box-shadow .18s;flex-shrink:0}
    .bubble:hover{transform:scale(1.09);box-shadow:0 8px 28px rgba(0,0,0,.35)}
    .bubble svg{transition:transform 280ms ease}
    .bubble.open svg{transform:rotate(-20deg) scale(1.08)}
    .nudge{position:fixed;background:#1e293b;color:#fff;padding:8px 13px;border-radius:999px;font:600 12px/1 -apple-system,sans-serif;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:2147483001;${posBottom ? 'bottom:30px' : 'top:30px'};${posRight ? 'right:88px' : 'left:88px'}}
    .nudge.hidden{display:none}
    .panel{display:none;width:370px;max-height:640px;background:#0A1628;color:#E6EBEF;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;margin-bottom:12px}
    .panel.open{display:flex}
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    .fade{animation:fadeUp 230ms cubic-bezier(.34,1.56,.64,1) both}

    /* Header */
    .head{padding:14px 16px;background:${accent};color:#fff;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
    .head-left{display:flex;align-items:center;gap:10px}
    .head-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
    .head-title{font-weight:700;font-size:15px;line-height:1.2}
    .head-sub{font-size:11px;opacity:.75;margin-top:2px;display:flex;align-items:center;gap:4px}
    .online-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}
    .close-btn{background:rgba(255,255,255,.15);border:0;color:#fff;cursor:pointer;width:30px;height:30px;border-radius:8px;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0}
    .close-btn:hover{background:rgba(255,255,255,.25)}

    /* Step progress */
    .steps{display:none;padding:12px 16px;border-bottom:1px solid #2A3F52;background:#0f1f35;align-items:center;gap:0;flex-shrink:0}
    .steps.visible{display:flex}
    .step-dot{width:24px;height:24px;border-radius:50%;border:2px solid #3A506B;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#9DA8B5;transition:all .2s;flex-shrink:0}
    .step-dot.active{background:${accent};border-color:${accent};color:#fff}
    .step-dot.done{background:#10B981;border-color:#10B981;color:#fff}
    .step-label{font-size:10px;font-weight:600;color:#9DA8B5;margin-top:3px;text-align:center;white-space:nowrap}
    .step-label.active{color:${accent}}
    .step-label.done{color:#10B981}
    .step-col{display:flex;flex-direction:column;align-items:center;gap:0}
    .step-line{flex:1;height:2px;background:#3A506B;margin:0 4px;margin-bottom:13px;transition:background .2s}
    .step-line.done{background:#10B981}

    /* Messages */
    .msgs{overflow-y:auto;padding:14px 14px 8px;background:#0D1B2A;flex:1;min-height:80px}
    .row{margin:6px 0;display:flex}
    .u{justify-content:flex-end} .a{justify-content:flex-start}
    .msg{max-width:80%;padding:10px 13px;border-radius:18px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}
    .u .msg{background:${accent};color:#fff;border-bottom-right-radius:4px}
    .a .msg{background:#1A2438;color:#E6EBEF;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2)}
    .typing-row{display:flex;padding:2px 0}
    .typing-bubble{background:#1A2438;border-radius:18px;border-bottom-left-radius:4px;padding:12px 16px;box-shadow:0 1px 4px rgba(0,0,0,.2);display:flex;gap:5px;align-items:center}
    .dot{width:7px;height:7px;border-radius:50%;background:#9DA8B5;animation:bounce .9s ease-in-out infinite}
    .dot:nth-child(2){animation-delay:.18s} .dot:nth-child(3){animation-delay:.36s}
    @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}

    /* Booking UI pane */
    .bui{background:#0A1628;border-top:1px solid #2A3F52;flex-shrink:0;overflow-y:auto;max-height:370px}
    .step-subtitle{font-size:10px;color:#9DA8B5;padding:12px 16px 0;opacity:.8}
    .section-label{font-size:11px;font-weight:700;color:#9DA8B5;text-transform:uppercase;letter-spacing:.6px;padding:6px 16px 8px}

    /* Service cards */
    .svc-list{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
    .svc-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid #3A506B;border-radius:13px;cursor:pointer;background:#1A2438;text-align:left;width:100%;transition:all .15s;font-family:inherit;color:#E6EBEF}
    .svc-card:hover{border-color:${accent};background:#2A3F52}
    .svc-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:${accent}28}
    .svc-name{font-weight:600;font-size:14px;color:#E6EBEF}
    .svc-meta{font-size:12px;color:#9DA8B5;margin-top:2px}
    .svc-arrow{color:#9DA8B5;font-size:18px;margin-left:auto;flex-shrink:0}

    /* Date shortcuts */
    .date-shortcuts{display:flex;gap:6px;padding:0 14px 8px}
    .shortcut-pill{background:#1A2438;border:1px solid #3A506B;color:#9DA8B5;border-radius:20px;padding:5px 14px;font-size:12px;cursor:pointer;transition:all 150ms;font-family:inherit}
    .shortcut-pill:hover,.shortcut-pill.sel{background:${accent};color:#fff;border-color:${accent}}

    /* Date nav + strip */
    .date-nav{display:flex;align-items:center;gap:6px;padding:0 14px 14px}
    .date-arrow{background:#1A2438;border:1px solid #3A506B;color:#E6EBEF;border-radius:8px;width:30px;height:30px;cursor:pointer;flex-shrink:0;font-size:20px;display:flex;align-items:center;justify-content:center;font-family:inherit;line-height:1;transition:all .15s}
    .date-arrow:hover{border-color:${accent};color:${accent}}
    .date-strip{display:flex;gap:8px;overflow-x:auto;flex:1;scrollbar-width:none}
    .date-strip::-webkit-scrollbar{display:none}
    .date-btn{display:flex;flex-direction:column;align-items:center;padding:10px 8px;border:2px solid #3A506B;border-radius:13px;cursor:pointer;background:#1A2438;min-width:54px;flex-shrink:0;transition:all .15s;font-family:inherit;color:#E6EBEF}
    .date-btn:hover{border-color:${accent}}
    .date-btn.sel{border-color:${accent};background:${accent};color:#fff}
    .date-btn.loading{opacity:.5;pointer-events:none}
    .dday{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.7}
    .dnum{font-size:20px;font-weight:800;margin-top:1px;line-height:1}
    .dmon{font-size:9px;margin-top:2px;opacity:.6;text-transform:uppercase;letter-spacing:.3px}

    /* Time grid */
    .time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14px 8px}
    .time-period-label{grid-column:1/-1;color:#9DA8B5;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin:8px 0 2px}
    .time-btn{padding:11px 4px;border:2px solid #3A506B;border-radius:11px;cursor:pointer;background:#1A2438;font-size:13px;font-weight:600;color:#E6EBEF;transition:all .15s;text-align:center;font-family:inherit}
    .time-btn:hover{border-color:${accent};color:${accent}}
    .time-btn.sel{border-color:${accent};background:${accent};color:#fff}
    .time-hint{display:block;color:#9DA8B5;font-size:12px;text-align:center;margin:6px 14px 14px}
    .no-slots{text-align:center;padding:24px 16px;color:#9DA8B5;font-size:13px;line-height:1.5}
    .no-slots-icon{font-size:36px;display:block;margin-bottom:8px}

    /* Details form */
    .form-wrap{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}
    .field label{display:block;font-size:11px;font-weight:700;color:#9DA8B5;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
    .field input{width:100%;padding:10px 13px;border:2px solid #3A506B;border-radius:11px;font-size:14px;color:#E6EBEF;background:#1A2438;outline:none;transition:border-color .15s;font-family:inherit}
    .field input:focus{border-color:${accent}}
    .field input.err{border-color:#EF4444}
    .field-error{color:#EF4444;font-size:12px;margin-top:4px;display:none}

    /* Summary */
    .summary{margin:0 14px 14px;border:2px solid #3A506B;border-radius:14px;overflow:hidden}
    .sum-row{display:flex;align-items:flex-start;gap:11px;padding:11px 14px;border-bottom:1px solid #2A3F52}
    .sum-row:last-child{border-bottom:0}
    .sum-ic{width:30px;height:30px;border-radius:8px;background:${accent}22;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:1px}
    .sum-text{font-size:13.5px;font-weight:600;color:#E6EBEF}
    .sum-sub{font-size:11px;color:#9DA8B5;margin-top:1px}
    .sum-note{font-size:11px;color:#9DA8B5;margin-top:3px;font-style:italic}

    /* Buttons */
    .btn{padding:12px 16px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit;border:0;text-align:center}
    .btn-primary{background:${accent};color:#fff}
    .btn-primary:hover{background:#059669}
    .btn-primary:disabled{opacity:.45;cursor:not-allowed}
    .btn-ghost{background:#1A2438;color:#9DA8B5;border:1px solid #3A506B}
    .btn-ghost:hover{border-color:${accent};color:${accent}}
    .btn-row{display:flex;gap:8px;padding:0 14px 14px}
    .btn-row .grow{flex:1}
    .btn-spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:5px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .chat-escape-btn{display:block;margin:14px auto 2px;background:none;border:none;color:#9DA8B5;font-size:12px;cursor:pointer;font-family:inherit}
    .chat-escape-btn:hover{color:#E6EBEF}
    .start-over-btn{display:block;margin:4px auto 12px;background:none;border:none;color:#9DA8B5;font-size:12px;cursor:pointer;text-decoration:underline;font-family:inherit}

    /* Success */
    .success{padding:28px 20px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
    .success-ring{width:68px;height:68px;border-radius:50%;background:#0D2818;display:flex;align-items:center;justify-content:center;font-size:34px}
    .success-title{font-size:20px;font-weight:800;color:#E6EBEF}
    .success-sub{font-size:13px;color:#9DA8B5;line-height:1.55}
    .success-card{background:#1A2438;border:1px solid #3A506B;border-radius:13px;padding:14px 16px;width:100%;text-align:left;font-size:13px;color:#E6EBEF;line-height:1.9}
    .cal-link{display:block;text-align:center;margin-top:2px;color:${accent};font-size:13px;text-decoration:none}
    .cal-link:hover{text-decoration:underline}

    /* Home */
    .home-wrap{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px}
    .book-btn{padding:14px;background:${accent};color:#fff;border:0;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;text-align:center}
    .book-btn:hover{background:#059669}
    .quick-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .quick-chip{padding:9px 4px;border:2px solid #3A506B;border-radius:11px;background:#1A2438;color:#9DA8B5;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}
    .quick-chip:hover{border-color:${accent};color:${accent}}

    /* Chat input */
    .chat-bar{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #2A3F52;background:#0A1628;flex-shrink:0}
    .chat-in{flex:1;padding:9px 13px;border:2px solid #3A506B;border-radius:22px;font-size:13.5px;color:#E6EBEF;background:#1A2438;outline:none;font-family:inherit;transition:border-color .15s}
    .chat-in::placeholder{color:#9DA8B5}
    .chat-in:focus{border-color:${accent}}
    .chat-send{padding:9px 16px;border:0;border-radius:22px;background:${accent};color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;flex-shrink:0}
    .chat-send:hover{background:#059669}
    .chat-send:disabled{opacity:.45;cursor:not-allowed}
  `;

  const bubble = el('button');
  bubble.className = 'bubble';
  bubble.innerHTML = launcherIcon;
  bubble.setAttribute('aria-label', 'Open chat');

  const nudge = el('div');
  nudge.className = 'nudge';
  nudge.textContent = '\u2702\uFE0F Book your next cut \u2192';

  const panel = el('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="head">
      <div class="head-left">
        <div class="head-avatar">${avatarIcon}</div>
        <div>
          <div class="head-title" id="biz-name">Book an Appointment</div>
          <div class="head-sub"><span class="online-dot"></span> Online now</div>
        </div>
      </div>
      <button class="close-btn" aria-label="Close">\u2715</button>
    </div>
    <div class="steps" id="steps"></div>
    <div class="msgs" id="msgs"></div>
    <div class="bui" id="bui"></div>
    <div class="chat-bar" id="chat-bar">
      <input class="chat-in" id="chat-in" placeholder="Ask anything\u2026" />
      <button class="chat-send" id="chat-send">Send</button>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(nudge);
  shadow.appendChild(bubble);

  const msgsEl   = panel.querySelector('#msgs');
  const buiEl    = panel.querySelector('#bui');
  const stepsEl  = panel.querySelector('#steps');
  const chatBar  = panel.querySelector('#chat-bar');
  const chatIn   = panel.querySelector('#chat-in');
  const chatSend = panel.querySelector('#chat-send');
  const bizName  = panel.querySelector('#biz-name');

  panel.querySelector('.close-btn').onclick = () => {
    panel.classList.remove('open');
    bubble.classList.remove('open');
    nudge.classList.remove('hidden');
  };

  // ── Utilities ──────────────────────────────────────────────────────────────────
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const SVC_ICON_MAP = {
    haircut:'✂️', cut:'✂️', fade:'✂️', trim:'✂️', snip:'✂️', style:'✂️', crop:'✂️',
    beard:'🧔', facial:'🧔', mustache:'🧔',
    shave:'🪒', straight:'🪒', hot:'🪒',
    color:'🎨', dye:'🎨', highlight:'🎨', tint:'🎨',
    kids:'👦', child:'👦', boy:'👦', junior:'👦'
  };
  function getServiceIcon(name) {
    const lower = name.toLowerCase();
    const found = Object.entries(SVC_ICON_MAP).find(([k]) => lower.includes(k));
    return found ? found[1] : '💈';
  }

  function emit(event, meta) {
    fetch(`${apiBase}/api/analytics/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, sessionId, event, meta: meta || {} })
    }).catch(() => null);
  }

  function addMsg(text, who) {
    const row = el('div'); row.className = `row ${who} fade`;
    const m = el('div'); m.className = 'msg'; m.textContent = text;
    row.appendChild(m);
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  let typingEl = null;
  function showTyping() {
    typingEl = el('div');
    typingEl.className = 'row a typing-row fade';
    typingEl.innerHTML = '<div class="typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    msgsEl.appendChild(typingEl);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    chatSend.disabled = true;
  }
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
    chatSend.disabled = false;
  }

  function showChatBar(show) { chatBar.style.display = show ? 'flex' : 'none'; }
  function clearBui() { buiEl.innerHTML = ''; }

  function resetToHome() {
    resetBooking();
    msgsEl.innerHTML = '';
    addMsg(greeting, 'a');
    showHome();
  }

  function addStepFooter(container) {
    const chatEscBtn = el('button');
    chatEscBtn.className = 'chat-escape-btn';
    chatEscBtn.textContent = '💬 Have a question? Ask us';
    chatEscBtn.onclick = () => showHome();
    container.appendChild(chatEscBtn);

    const startOverBtn = el('button');
    startOverBtn.className = 'start-over-btn';
    startOverBtn.textContent = '↩ Start over';
    startOverBtn.onclick = resetToHome;
    container.appendChild(startOverBtn);
  }

  const STEP_DEFS = [
    { key: 'service', label: 'Service' },
    { key: 'date',    label: 'Date'    },
    { key: 'time',    label: 'Time'    },
    { key: 'details', label: 'Details' },
    { key: 'confirm', label: 'Confirm' }
  ];

  function renderSteps(current) {
    const idx = STEP_DEFS.findIndex(s => s.key === current);
    if (idx === -1) { stepsEl.classList.remove('visible'); stepsEl.innerHTML = ''; return; }
    stepsEl.classList.add('visible');
    let html = '';
    STEP_DEFS.forEach((s, i) => {
      const done = i < idx, active = i === idx;
      const dc = done ? 'done' : active ? 'active' : '';
      const lc = done ? 'done' : active ? 'active' : '';
      html += `<div class="step-col"><div class="step-dot ${dc}">${done ? '\u2713' : i + 1}</div><div class="step-label ${lc}">${s.label}</div></div>`;
      if (i < STEP_DEFS.length - 1) html += `<div class="step-line ${done ? 'done' : ''}"></div>`;
    });
    stepsEl.innerHTML = html;
  }

  // ── Config ────────────────────────────────────────────────────────────────────
  async function loadConfig() {
    try {
      const res  = await fetch(`${apiBase}/api/widget/config?businessId=${encodeURIComponent(businessId)}`);
      const data = await res.json();
      if (!data.error && Array.isArray(data.services) && data.services.length) {
        widgetConfig = {
          name: data.name || widgetConfig.name,
          timezone: data.timezone || widgetConfig.timezone,
          bookingMode: data.bookingMode || widgetConfig.bookingMode,
          services: data.services,
          contactPhone: data.contact?.phone || '',
          contactAddress: data.contact?.address || ''
        };
        widgetToken = data.widgetToken || '';
        bizName.textContent = data.name || 'Book an Appointment';
      }
    } catch { /* keep defaults */ }
  }

  // ── API ───────────────────────────────────────────────────────────────────────
  async function apiAvailability(serviceName, dateISO) {
    const r = await fetch(`${apiBase}/api/booking/availability`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-widget-token': widgetToken },
      body: JSON.stringify({ businessId, serviceName, date: dateISO })
    });
    return r.json();
  }

  async function apiCreateBooking() {
    const key = [businessId, sessionId, booking.serviceName, booking.selectedSlotISO,
      (booking.customerName || '').toLowerCase().trim(), (booking.customerEmail || '').toLowerCase().trim()].join('|').slice(0, 190);
    const body = { businessId, serviceName: booking.serviceName, startTimeISO: booking.selectedSlotISO, customerName: booking.customerName, customerEmail: booking.customerEmail, idempotencyKey: key };
    if (booking.customerPhone) body.customerPhone = booking.customerPhone;
    const r = await fetch(`${apiBase}/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-widget-token': widgetToken, 'x-idempotency-key': key },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  function makeICSUrl(startISO, svc, bizNm, addr) {
    const dt  = startISO.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WidgetAI//EN', 'BEGIN:VEVENT',
      'DTSTART:' + dt, 'SUMMARY:' + svc + ' at ' + bizNm,
      'LOCATION:' + (addr || ''), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(ics);
  }

  // ── Screens ───────────────────────────────────────────────────────────────────
  function showHome() {
    renderSteps('');
    clearBui();
    showChatBar(true);
    chatIn.placeholder = 'Ask anything\u2026';
    const div = el('div'); div.className = 'home-wrap fade';

    const bookBtn = el('button'); bookBtn.className = 'book-btn';
    bookBtn.textContent = '📅 Book an Appointment';
    bookBtn.onclick = startFlow;

    const quickRow = el('div'); quickRow.className = 'quick-row';
    [['🕐 Hours', 'What are your hours?'], ['✂️ Services', 'What services do you offer?'], ['📞 Contact', 'How can I contact you?']].forEach(([label, msg]) => {
      const chip = el('button'); chip.className = 'quick-chip'; chip.textContent = label;
      chip.onclick = () => sendChat(msg);
      quickRow.appendChild(chip);
    });

    div.appendChild(bookBtn);
    div.appendChild(quickRow);
    buiEl.appendChild(div);
  }

  function showServiceStep() {
    booking.active = true; booking.step = 'service'; saveBooking();
    renderSteps('service');
    clearBui();
    showChatBar(false);

    const wrap = el('div'); wrap.className = 'fade';
    const sub  = el('div'); sub.className = 'step-subtitle'; sub.textContent = 'Step 1 of 5';
    const lbl  = el('div'); lbl.className = 'section-label'; lbl.textContent = 'Choose your service';
    const list = el('div'); list.className = 'svc-list';

    widgetConfig.services.slice(0, 6).forEach(svc => {
      const btn   = el('button'); btn.className = 'svc-card';
      const dur   = svc.durationMin ? `${svc.durationMin} min` : '';
      const price = svc.priceRange  || '';
      const meta  = [dur, price].filter(Boolean).join(' \u00B7 ');

      const icon  = el('div'); icon.className = 'svc-icon'; icon.textContent = getServiceIcon(svc.name);
      const info  = el('div'); info.style.flex = '1';
      const nm    = el('div'); nm.className = 'svc-name'; nm.textContent = svc.name;
      const mt    = el('div'); mt.className = 'svc-meta'; mt.textContent = meta;
      const arrow = el('div'); arrow.className = 'svc-arrow'; arrow.textContent = '\u203A';

      info.appendChild(nm);
      if (meta) info.appendChild(mt);
      btn.appendChild(icon); btn.appendChild(info); btn.appendChild(arrow);
      btn.onclick = () => pickService(svc.name);
      list.appendChild(btn);
    });

    wrap.appendChild(sub);
    wrap.appendChild(lbl);
    wrap.appendChild(list);
    addStepFooter(wrap);
    buiEl.appendChild(wrap);
  }

  function pickService(name) {
    booking.serviceName = name; booking.step = 'date'; saveBooking();
    addMsg(name, 'u');
    emit('service_selected', { serviceName: name });
    showDateStep();
  }

  function showDateStep() {
    renderSteps('date');
    clearBui();
    showChatBar(false);

    const wrap = el('div'); wrap.className = 'fade';
    const sub  = el('div'); sub.className = 'step-subtitle'; sub.textContent = 'Step 2 of 5';
    const lbl  = el('div'); lbl.className = 'section-label'; lbl.textContent = 'Pick a date';
    wrap.appendChild(sub);
    wrap.appendChild(lbl);

    // Today / Tomorrow shortcuts
    const now         = new Date();
    const todayISO    = now.toISOString().split('T')[0];
    const tomorrowD   = new Date(now); tomorrowD.setDate(now.getDate() + 1);
    const tomorrowISO = tomorrowD.toISOString().split('T')[0];

    const shortcuts = el('div'); shortcuts.className = 'date-shortcuts';
    [['Today', todayISO], ['Tomorrow', tomorrowISO]].forEach(([label, targetISO]) => {
      const p = el('button');
      p.className = 'shortcut-pill' + (targetISO === booking.dateISO ? ' sel' : '');
      p.textContent = label;
      p.onclick = () => {
        const btn = strip.querySelector(`[data-iso="${targetISO}"]`);
        if (btn) { btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); pickDate(targetISO, btn, strip); }
      };
      shortcuts.appendChild(p);
    });
    wrap.appendChild(shortcuts);

    // Date nav row: ‹ strip ›
    const navRow = el('div'); navRow.className = 'date-nav';
    const prevBtn = el('button'); prevBtn.className = 'date-arrow'; prevBtn.innerHTML = '&#8249;';
    const strip   = el('div');   strip.className = 'date-strip';
    const nextBtn = el('button'); nextBtn.className = 'date-arrow'; nextBtn.innerHTML = '&#8250;';
    prevBtn.onclick = () => strip.scrollBy({ left: -220, behavior: 'smooth' });
    nextBtn.onclick = () => strip.scrollBy({ left:  220, behavior: 'smooth' });

    for (let i = 0; i <= 27; i++) {
      const d   = new Date(now); d.setDate(now.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const btn = el('button');
      btn.className  = 'date-btn' + (iso === booking.dateISO ? ' sel' : '');
      btn.dataset.iso = iso;
      const dd = el('div'); dd.className = 'dday'; dd.textContent = DAYS[d.getDay()];
      const dn = el('div'); dn.className = 'dnum'; dn.textContent = d.getDate();
      const dm = el('div'); dm.className = 'dmon'; dm.textContent = MONTHS[d.getMonth()];
      btn.appendChild(dd); btn.appendChild(dn); btn.appendChild(dm);
      btn.onclick = () => pickDate(iso, btn, strip);
      strip.appendChild(btn);
    }

    navRow.appendChild(prevBtn);
    navRow.appendChild(strip);
    navRow.appendChild(nextBtn);
    wrap.appendChild(navRow);

    // Back button
    const backRow = el('div'); backRow.className = 'btn-row';
    const back = el('button'); back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Change service';
    back.onclick = () => { addMsg('\u2190 Change service', 'u'); showServiceStep(); };
    backRow.appendChild(back);
    wrap.appendChild(backRow);

    addStepFooter(wrap);
    buiEl.appendChild(wrap);
  }

  async function pickDate(iso, btnEl, strip) {
    strip.querySelectorAll('.date-btn').forEach(b => b.classList.remove('sel'));
    btnEl.classList.add('sel', 'loading');
    booking.dateISO = iso; saveBooking();
    const d = new Date(iso + 'T12:00:00');
    addMsg(`${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`, 'u');
    emit('date_selected', { dateISO: iso });
    showTyping();
    const data = await apiAvailability(booking.serviceName, iso);
    hideTyping();
    btnEl.classList.remove('loading');
    if (data.error) {
      addMsg(`${data.error} You can also call ${widgetConfig.contactPhone || 'us'} to book.`, 'a');
      btnEl.classList.remove('sel');
      return;
    }
    booking.slots    = data.slots || [];
    booking.timezone = data.timezone || widgetConfig.timezone;
    saveBooking();
    if (!booking.slots.length) {
      addMsg('No openings on that day. Try another date.', 'a');
      btnEl.classList.remove('sel');
      return;
    }
    showTimeStep();
  }

  function showTimeStep() {
    booking.step = 'time'; saveBooking();
    renderSteps('time');
    clearBui();
    showChatBar(false);

    const tz   = booking.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const wrap = el('div'); wrap.className = 'fade';
    const sub  = el('div'); sub.className = 'step-subtitle'; sub.textContent = 'Step 3 of 5';
    const lbl  = el('div'); lbl.className = 'section-label';
    lbl.innerHTML = `Pick a time <span style="font-size:10px;text-transform:none;font-weight:400;letter-spacing:0">(${tz})</span>`;
    wrap.appendChild(sub);
    wrap.appendChild(lbl);

    const grid = el('div'); grid.className = 'time-grid';
    let lastPeriod = '';

    booking.slots.slice(0, 18).forEach(iso => {
      let localHour = 12;
      try {
        const h = new Date(iso).toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: tz });
        localHour = parseInt(h, 10) % 24;
      } catch { /* fallback */ }

      const period = localHour < 12 ? 'Morning' : localHour < 17 ? 'Afternoon' : 'Evening';
      if (period !== lastPeriod) {
        const hdr = el('div'); hdr.className = 'time-period-label'; hdr.textContent = period;
        grid.appendChild(hdr);
        lastPeriod = period;
      }

      const btn = el('button'); btn.className = 'time-btn';
      btn.textContent = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      btn.onclick = () => pickSlot(iso, btn, grid);
      grid.appendChild(btn);
    });

    wrap.appendChild(grid);

    const hint = el('span'); hint.className = 'time-hint'; hint.textContent = 'Tap a time to continue \u2192';
    wrap.appendChild(hint);

    const backRow = el('div'); backRow.className = 'btn-row';
    const back = el('button'); back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Pick a different date';
    back.onclick = () => { addMsg('\u2190 Different date', 'u'); showDateStep(); };
    backRow.appendChild(back);
    wrap.appendChild(backRow);

    addStepFooter(wrap);
    buiEl.appendChild(wrap);
  }

  function pickSlot(iso, btnEl, grid) {
    grid.querySelectorAll('.time-btn').forEach(b => b.classList.remove('sel'));
    btnEl.classList.add('sel');
    booking.selectedSlotISO = iso; booking.step = 'details'; saveBooking();
    const tz = booking.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    addMsg(new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }), 'u');
    emit('slot_selected', { slotISO: iso });
    showDetailsStep();
  }

  function showDetailsStep() {
    renderSteps('details');
    clearBui();
    showChatBar(false);

    const wrap = el('div'); wrap.className = 'fade';
    const sub  = el('div'); sub.className = 'step-subtitle'; sub.textContent = 'Step 4 of 5';
    const lbl  = el('div'); lbl.className = 'section-label'; lbl.textContent = 'Your details';
    wrap.appendChild(sub);
    wrap.appendChild(lbl);

    const formWrap = el('div'); formWrap.className = 'form-wrap';

    // Name
    const nameField = el('div'); nameField.className = 'field';
    const nameLbl   = el('label'); nameLbl.textContent = 'Full name';
    const nameIn    = el('input'); nameIn.type = 'text'; nameIn.placeholder = 'Jane Smith';
    nameIn.value = booking.customerName || ''; nameIn.autocomplete = 'name';
    const nameErr = el('div'); nameErr.className = 'field-error';
    nameErr.textContent = 'Please enter your full name (at least 2 characters).';
    nameField.appendChild(nameLbl); nameField.appendChild(nameIn); nameField.appendChild(nameErr);

    // Email
    const emailField = el('div'); emailField.className = 'field';
    const emailLbl   = el('label'); emailLbl.textContent = 'Email address';
    const emailIn    = el('input'); emailIn.type = 'email'; emailIn.placeholder = 'jane@example.com';
    emailIn.value = booking.customerEmail || ''; emailIn.autocomplete = 'email';
    const emailErr = el('div'); emailErr.className = 'field-error';
    emailErr.textContent = 'Please enter a valid email (e.g. yourname@gmail.com).';
    emailField.appendChild(emailLbl); emailField.appendChild(emailIn); emailField.appendChild(emailErr);

    // Phone (optional)
    const phoneField = el('div'); phoneField.className = 'field';
    const phoneLbl   = el('label');
    phoneLbl.innerHTML = 'Phone <span style="color:#9DA8B5;font-size:11px;font-weight:400;text-transform:none">(optional)</span>';
    const phoneIn = el('input'); phoneIn.type = 'tel'; phoneIn.placeholder = '+1 (555) 000-0000';
    phoneIn.value = booking.customerPhone || ''; phoneIn.autocomplete = 'tel';
    phoneField.appendChild(phoneLbl); phoneField.appendChild(phoneIn);

    formWrap.appendChild(nameField);
    formWrap.appendChild(emailField);
    formWrap.appendChild(phoneField);
    wrap.appendChild(formWrap);

    const btnRow = el('div'); btnRow.className = 'btn-row';
    const back = el('button'); back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Choose a different time';
    back.onclick = () => { addMsg('\u2190 Different time', 'u'); showTimeStep(); };
    const next = el('button'); next.className = 'btn btn-primary grow';
    next.textContent = 'Review booking \u2192';
    next.onclick = () => {
      const name  = nameIn.value.trim();
      const email = emailIn.value.trim();
      nameIn.classList.remove('err'); emailIn.classList.remove('err');
      nameErr.style.display = 'none'; emailErr.style.display = 'none';
      let ok = true;
      if (name.length < 2)                             { nameIn.classList.add('err'); nameErr.style.display = 'block'; nameIn.focus(); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  { emailIn.classList.add('err'); emailErr.style.display = 'block'; if (ok) emailIn.focus(); ok = false; }
      if (!ok) return;
      booking.customerName  = name;
      booking.customerEmail = email;
      booking.customerPhone = phoneIn.value.trim();
      saveBooking();
      showConfirmStep();
    };
    btnRow.appendChild(back); btnRow.appendChild(next);
    wrap.appendChild(btnRow);

    addStepFooter(wrap);
    buiEl.appendChild(wrap);
    setTimeout(() => nameIn.focus(), 60);
  }

  function showConfirmStep() {
    booking.step = 'confirm'; saveBooking();
    renderSteps('confirm');
    clearBui();
    showChatBar(false);

    const tz      = booking.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dt      = new Date(booking.selectedSlotISO);
    const dtLabel = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz })
                  + ' at '
                  + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

    const wrap = el('div'); wrap.className = 'fade';
    const sub  = el('div'); sub.className = 'step-subtitle'; sub.textContent = 'Step 5 of 5';
    const lbl  = el('div'); lbl.className = 'section-label'; lbl.textContent = 'Confirm your booking';
    wrap.appendChild(sub);
    wrap.appendChild(lbl);

    const summary = el('div'); summary.className = 'summary';

    const rows = [
      ['✂️', booking.serviceName, 'Service'],
      ['📅', dtLabel,             'Date & time'],
      ['👤', booking.customerName,'Name']
    ];
    rows.forEach(([ic, text, sub2]) => {
      const row = el('div'); row.className = 'sum-row';
      row.innerHTML = `<div class="sum-ic">${ic}</div><div><div class="sum-text">${text}</div><div class="sum-sub">${sub2}</div></div>`;
      summary.appendChild(row);
    });

    // Email row with confirmation note
    const emailRow = el('div'); emailRow.className = 'sum-row';
    const emailIc  = el('div'); emailIc.className = 'sum-ic'; emailIc.textContent = '📧';
    const emailDiv = el('div');
    emailDiv.innerHTML = `<div class="sum-text">${booking.customerEmail}</div><div class="sum-sub">Email</div><div class="sum-note">Confirmation will be sent here</div>`;
    emailRow.appendChild(emailIc); emailRow.appendChild(emailDiv);
    summary.appendChild(emailRow);

    wrap.appendChild(summary);

    const btnRow    = el('div'); btnRow.className = 'btn-row';
    const back      = el('button'); back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Edit my details';
    back.onclick = () => { addMsg('\u2190 Edit details', 'u'); showDetailsStep(); };

    const confirmBtn = el('button'); confirmBtn.className = 'btn btn-primary grow';
    confirmBtn.textContent = '\u2713 Confirm Booking';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="btn-spinner"></span> Booking\u2026';
      showTyping();
      const data = await apiCreateBooking();
      hideTyping();
      if (data.error) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '\u2713 Confirm Booking';
        emit('booking_failed', { error: data.error });
        addMsg(`Booking failed: ${data.error}. Please call ${widgetConfig.contactPhone || 'us'} to book.`, 'a');
        return;
      }
      emit('booking_confirmed', { bookingId: data.bookingId || '', slotISO: booking.selectedSlotISO });
      const s = booking.selectedSlotISO, svc = booking.serviceName, nm = booking.customerName, em = booking.customerEmail;
      resetBooking();
      showSuccess(s, svc, nm, em);
    };

    btnRow.appendChild(back); btnRow.appendChild(confirmBtn);
    wrap.appendChild(btnRow);

    addStepFooter(wrap);
    buiEl.appendChild(wrap);
  }

  function showSuccess(slotISO, svc, name, email) {
    renderSteps('');
    clearBui();
    showChatBar(false);

    const dt      = new Date(slotISO);
    const dtLabel = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  + '\n'
                  + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const wrap  = el('div'); wrap.className = 'success fade';
    const ring  = el('div'); ring.className = 'success-ring'; ring.textContent = '\u2705';
    const title = el('div'); title.className = 'success-title'; title.textContent = "You're booked!";
    const sub   = el('div'); sub.className = 'success-sub';
    sub.innerHTML = `Confirmation sent to<br><strong>${email}</strong>`;
    const card = el('div'); card.className = 'success-card';
    card.innerHTML = `<strong>${svc}</strong><br>\uD83D\uDCC5 ${dtLabel}<br>\uD83D\uDC64 ${name}`;

    const calLink = el('a'); calLink.className = 'cal-link';
    calLink.href = makeICSUrl(slotISO, svc, widgetConfig.name, widgetConfig.contactAddress);
    calLink.download = 'booking.ics';
    calLink.textContent = '\uD83D\uDCC5 Add to Calendar';

    const doneBtn = el('button'); doneBtn.className = 'btn btn-ghost';
    doneBtn.textContent = 'Done'; doneBtn.style.width = '100%';
    doneBtn.onclick = () => { msgsEl.innerHTML = ''; clearBui(); addMsg(greeting, 'a'); showHome(); };

    wrap.appendChild(ring); wrap.appendChild(title); wrap.appendChild(sub);
    wrap.appendChild(card); wrap.appendChild(calLink); wrap.appendChild(doneBtn);
    buiEl.appendChild(wrap);
  }

  function startFlow() {
    if (widgetConfig.bookingMode !== 'calendar') {
      addMsg(`Online booking isn\u2019t available right now. Please call ${widgetConfig.contactPhone || 'us'} to book.`, 'a');
      return;
    }
    addMsg("Let\u2019s get you booked!", 'a');
    emit('booking_started');
    showServiceStep();
  }

  // ── Chat mode ─────────────────────────────────────────────────────────────────
  async function sendChat(text) {
    const msg = String(text || '').trim();
    if (!msg) return;
    chatIn.value = '';
    addMsg(msg, 'u');
    showTyping();
    try {
      const r    = await fetch(`${apiBase}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-widget-token': widgetToken }, body: JSON.stringify({ businessId, sessionId, message: msg }) });
      const data = await r.json();
      hideTyping();
      addMsg(data.error || data.message || 'How can I help?', 'a');
    } catch {
      hideTyping();
      addMsg('Network error. Please try again.', 'a');
    }
  }

  function handleSend() {
    const t = chatIn.value.trim();
    if (t) sendChat(t);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  loadConfig().finally(() => {
    addMsg(greeting, 'a');
    if (consent) addMsg(consent, 'a');
    if (booking.active && booking.step) {
      addMsg('Welcome back \u2014 continuing your booking.', 'a');
      const step = booking.step;
      if      (step === 'date')                        showDateStep();
      else if (step === 'time' && booking.slots.length) showTimeStep();
      else if (step === 'details')                     showDetailsStep();
      else if (step === 'confirm')                     showConfirmStep();
      else                                             showServiceStep();
    } else {
      showHome();
    }
  });

  bubble.onclick = () => {
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open');
    bubble.classList.toggle('open');
    nudge.classList.toggle('hidden', !isOpen);
    if (!isOpen) chatIn.focus();
  };

  chatSend.onclick = handleSend;
  chatIn.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
})();
