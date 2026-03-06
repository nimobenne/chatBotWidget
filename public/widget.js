(function () {
  const script = document.currentScript;
  if (!script) return;

  const businessId = script.getAttribute('data-business') || 'demo_barber';
  const position   = script.getAttribute('data-position') || 'bottom-right';
  const accent     = script.getAttribute('data-accent')   || '#111827';
  const icon       = script.getAttribute('data-icon')     || '💬';
  const greeting   = script.getAttribute('data-greeting') || 'Hi! How can I help you today?';
  const consent    = script.getAttribute('data-consent')  || '';
  const apiBase    = new URL(script.src, window.location.href).origin;

  const sessionKey = `ai_receptionist_session_${businessId}`;
  const sessionId  = localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, sessionId);

  let widgetConfig = {
    name: 'Book an Appointment',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    bookingMode: 'calendar',
    services: [{ name: 'Classic Haircut', durationMin: 30 }, { name: 'Skin Fade', durationMin: 45 }, { name: 'Beard Trim', durationMin: 20 }],
    contactPhone: ''
  };
  let widgetToken = '';

  const bookingKey = `ai_receptionist_booking_${businessId}_${sessionId}`;
  const blankBooking = { active: false, step: 'service', serviceName: '', dateISO: '', selectedSlotISO: '', customerName: '', customerEmail: '', slots: [], timezone: '' };
  let booking = (() => { try { const r = localStorage.getItem(bookingKey); return r ? { ...blankBooking, ...JSON.parse(r) } : { ...blankBooking }; } catch { return { ...blankBooking }; } })();
  function saveBooking() { localStorage.setItem(bookingKey, JSON.stringify(booking)); }
  function resetBooking() { booking = { ...blankBooking }; saveBooking(); }

  // ── DOM scaffold ──────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;z-index:2147483000;${position.includes('bottom') ? 'bottom:20px' : 'top:20px'};${position.includes('right') ? 'right:20px' : 'left:20px'}`;
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: 'open' });

  const posRight = position.includes('right');
  const posBottom = position.includes('bottom');

  const style = document.createElement('style');
  style.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    .bubble{width:58px;height:58px;border-radius:50%;background:${accent};color:#fff;border:0;cursor:pointer;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.28);transition:transform .18s,box-shadow .18s;flex-shrink:0}
    .bubble:hover{transform:scale(1.09);box-shadow:0 8px 28px rgba(0,0,0,.35)}
    .nudge{position:fixed;background:#1e293b;color:#fff;padding:8px 13px;border-radius:999px;font:600 12px/1 -apple-system,sans-serif;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:2147483001;${posBottom ? 'bottom:30px' : 'top:30px'};${posRight ? 'right:88px' : 'left:88px'}}
    .nudge.hidden{display:none}
    .panel{display:none;width:370px;max-height:610px;background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.22);overflow:hidden;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;margin-bottom:12px}
    .panel.open{display:flex}

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
    .steps{display:none;padding:12px 16px;border-bottom:1px solid #f1f5f9;background:#fafbfc;align-items:center;gap:0;flex-shrink:0}
    .steps.visible{display:flex}
    .step-dot{width:24px;height:24px;border-radius:50%;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#94a3b8;transition:all .2s;flex-shrink:0}
    .step-dot.active{background:${accent};border-color:${accent};color:#fff}
    .step-dot.done{background:#10b981;border-color:#10b981;color:#fff}
    .step-label{font-size:10px;font-weight:600;color:#94a3b8;margin-top:3px;text-align:center;white-space:nowrap}
    .step-label.active{color:${accent}}
    .step-label.done{color:#10b981}
    .step-col{display:flex;flex-direction:column;align-items:center;gap:0}
    .step-line{flex:1;height:2px;background:#e2e8f0;margin:0 4px;margin-bottom:13px;transition:background .2s}
    .step-line.done{background:#10b981}

    /* Messages */
    .msgs{overflow-y:auto;padding:14px 14px 8px;background:#f8fafc;flex:1;min-height:80px}
    .row{margin:6px 0;display:flex}
    .u{justify-content:flex-end} .a{justify-content:flex-start}
    .msg{max-width:80%;padding:10px 13px;border-radius:18px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}
    .u .msg{background:${accent};color:#fff;border-bottom-right-radius:4px}
    .a .msg{background:#fff;color:#1e293b;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .typing-row{display:flex;padding:2px 0}
    .typing-bubble{background:#fff;border-radius:18px;border-bottom-left-radius:4px;padding:12px 16px;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;gap:5px;align-items:center}
    .dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:bounce .9s ease-in-out infinite}
    .dot:nth-child(2){animation-delay:.18s} .dot:nth-child(3){animation-delay:.36s}
    @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}

    /* Booking UI pane */
    .bui{background:#fff;border-top:1px solid #f1f5f9;flex-shrink:0;overflow-y:auto;max-height:340px}
    .section-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;padding:14px 16px 8px}

    /* Service cards */
    .svc-list{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
    .svc-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid #e2e8f0;border-radius:13px;cursor:pointer;background:#fff;text-align:left;width:100%;transition:all .15s;font-family:inherit}
    .svc-card:hover{border-color:${accent};background:#f9f8ff}
    .svc-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:${accent}18}
    .svc-name{font-weight:600;font-size:14px;color:#1e293b}
    .svc-meta{font-size:12px;color:#64748b;margin-top:2px}
    .svc-arrow{color:#cbd5e1;font-size:18px;margin-left:auto;flex-shrink:0}

    /* Date strip */
    .date-strip{display:flex;gap:8px;overflow-x:auto;padding:0 14px 14px;scrollbar-width:none}
    .date-strip::-webkit-scrollbar{display:none}
    .date-btn{display:flex;flex-direction:column;align-items:center;padding:10px 8px;border:2px solid #e2e8f0;border-radius:13px;cursor:pointer;background:#fff;min-width:54px;flex-shrink:0;transition:all .15s;font-family:inherit}
    .date-btn:hover{border-color:${accent}}
    .date-btn.sel{border-color:${accent};background:${accent};color:#fff}
    .date-btn.loading{opacity:.5;pointer-events:none}
    .dday{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.7}
    .dnum{font-size:20px;font-weight:800;margin-top:1px;line-height:1}
    .dmon{font-size:9px;margin-top:2px;opacity:.6;text-transform:uppercase;letter-spacing:.3px}

    /* Time grid */
    .time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14px 14px}
    .time-btn{padding:11px 4px;border:2px solid #e2e8f0;border-radius:11px;cursor:pointer;background:#fff;font-size:13px;font-weight:600;color:#374151;transition:all .15s;text-align:center;font-family:inherit}
    .time-btn:hover{border-color:${accent};color:${accent}}
    .time-btn.sel{border-color:${accent};background:${accent};color:#fff}
    .no-slots{text-align:center;padding:24px 16px;color:#64748b;font-size:13px;line-height:1.5}
    .no-slots-icon{font-size:36px;display:block;margin-bottom:8px}

    /* Details form */
    .form-wrap{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}
    .field label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
    .field input{width:100%;padding:10px 13px;border:2px solid #e2e8f0;border-radius:11px;font-size:14px;color:#1e293b;outline:none;transition:border-color .15s;font-family:inherit}
    .field input:focus{border-color:${accent}}
    .field input.err{border-color:#ef4444}

    /* Summary */
    .summary{margin:0 14px 14px;border:2px solid #f1f5f9;border-radius:14px;overflow:hidden}
    .sum-row{display:flex;align-items:flex-start;gap:11px;padding:11px 14px;border-bottom:1px solid #f8fafc}
    .sum-row:last-child{border-bottom:0}
    .sum-ic{width:30px;height:30px;border-radius:8px;background:${accent}12;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:1px}
    .sum-text{font-size:13.5px;font-weight:600;color:#1e293b}
    .sum-sub{font-size:11px;color:#94a3b8;margin-top:1px}

    /* Buttons */
    .btn{padding:12px 16px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit;border:0;text-align:center}
    .btn-primary{background:${accent};color:#fff}
    .btn-primary:hover{opacity:.9}
    .btn-primary:disabled{opacity:.45;cursor:not-allowed}
    .btn-ghost{background:#f1f5f9;color:#475569;border:0}
    .btn-ghost:hover{background:#e2e8f0}
    .btn-row{display:flex;gap:8px;padding:0 14px 14px}
    .btn-row .grow{flex:1}

    /* Success */
    .success{padding:28px 20px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
    .success-ring{width:68px;height:68px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:34px}
    .success-title{font-size:20px;font-weight:800;color:#1e293b}
    .success-sub{font-size:13px;color:#64748b;line-height:1.55}
    .success-card{background:#f8fafc;border-radius:13px;padding:14px 16px;width:100%;text-align:left;font-size:13px;color:#374151;line-height:1.9}

    /* Home */
    .home-wrap{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px}
    .book-btn{padding:14px;background:${accent};color:#fff;border:0;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s;text-align:center}
    .book-btn:hover{opacity:.9}
    .quick-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .quick-chip{padding:9px 4px;border:2px solid #e2e8f0;border-radius:11px;background:#fff;color:#374151;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}
    .quick-chip:hover{border-color:${accent};color:${accent}}

    /* Chat input */
    .chat-bar{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #f1f5f9;background:#fff;flex-shrink:0}
    .chat-in{flex:1;padding:9px 13px;border:2px solid #e2e8f0;border-radius:22px;font-size:13.5px;color:#1e293b;outline:none;font-family:inherit;transition:border-color .15s}
    .chat-in:focus{border-color:${accent}}
    .chat-send{padding:9px 16px;border:0;border-radius:22px;background:${accent};color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s;flex-shrink:0}
    .chat-send:disabled{opacity:.45;cursor:not-allowed}

    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .fade{animation:fadeUp .2s ease}
  `;

  const bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.innerHTML = icon;
  bubble.setAttribute('aria-label', 'Open chat');

  const nudge = document.createElement('div');
  nudge.className = 'nudge';
  nudge.textContent = 'Book online now \u2192';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="head">
      <div class="head-left">
        <div class="head-avatar">${icon}</div>
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
  panel.querySelector('.close-btn').onclick = () => { panel.classList.remove('open'); nudge.classList.remove('hidden'); };

  // ── Utilities ──────────────────────────────────────────────────────────────────
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const SVC_ICONS = ['&#9986;','&#128136;','&#129298;','&#128135;','&#129498;','&#128134;','&#10024;'];

  function emit(event, meta) {
    fetch(`${apiBase}/api/analytics/event`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ businessId, sessionId, event, meta: meta || {} })
    }).catch(() => null);
  }

  function addMsg(text, who) {
    const row = document.createElement('div');
    row.className = `row ${who} fade`;
    const m = document.createElement('div');
    m.className = 'msg';
    m.textContent = text;
    row.appendChild(m);
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  let typingEl = null;
  function showTyping() {
    typingEl = document.createElement('div');
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
      const done   = i < idx;
      const active = i === idx;
      const dc = done ? 'done' : active ? 'active' : '';
      const lc = done ? 'done' : active ? 'active' : '';
      html += `<div class="step-col"><div class="step-dot ${dc}">${done ? '\u2713' : i+1}</div><div class="step-label ${lc}">${s.label}</div></div>`;
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
        widgetConfig = { name: data.name || widgetConfig.name, timezone: data.timezone || widgetConfig.timezone, bookingMode: data.bookingMode || widgetConfig.bookingMode, services: data.services, contactPhone: data.contact?.phone || '' };
        widgetToken = data.widgetToken || '';
        bizName.textContent = data.name || 'Book an Appointment';
      }
    } catch { /* keep defaults */ }
  }

  // ── API ───────────────────────────────────────────────────────────────────────
  async function apiAvailability(serviceName, dateISO) {
    const r = await fetch(`${apiBase}/api/booking/availability`, {
      method: 'POST', headers: {'Content-Type':'application/json','x-widget-token': widgetToken},
      body: JSON.stringify({ businessId, serviceName, date: dateISO })
    });
    return r.json();
  }

  async function apiCreateBooking() {
    const key = [businessId, sessionId, booking.serviceName, booking.selectedSlotISO, (booking.customerName||'').toLowerCase().trim(), (booking.customerEmail||'').toLowerCase().trim()].join('|').slice(0, 190);
    const r = await fetch(`${apiBase}/api/booking/create`, {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-widget-token': widgetToken,'x-idempotency-key': key},
      body: JSON.stringify({ businessId, serviceName: booking.serviceName, startTimeISO: booking.selectedSlotISO, customerName: booking.customerName, customerEmail: booking.customerEmail, idempotencyKey: key })
    });
    return r.json();
  }

  // ── Screens ───────────────────────────────────────────────────────────────────

  function showHome() {
    renderSteps('');
    clearBui();
    showChatBar(true);
    chatIn.placeholder = 'Ask anything\u2026';
    const div = document.createElement('div');
    div.className = 'home-wrap fade';
    div.innerHTML = `
      <button class="book-btn" id="do-book">\uD83D\uDCC5 Book an Appointment</button>
      <div class="quick-row">
        <button class="quick-chip" id="q-hours">\uD83D\uDD52 Hours</button>
        <button class="quick-chip" id="q-svc">\u2702\uFE0F Services</button>
        <button class="quick-chip" id="q-contact">\uD83D\uDCDE Contact</button>
      </div>
    `;
    buiEl.appendChild(div);
    div.querySelector('#do-book').onclick   = startFlow;
    div.querySelector('#q-hours').onclick   = () => sendChat('What are your hours?');
    div.querySelector('#q-svc').onclick     = () => sendChat('What services do you offer?');
    div.querySelector('#q-contact').onclick = () => sendChat('How can I contact you?');
  }

  function showServiceStep() {
    booking.active = true; booking.step = 'service'; saveBooking();
    renderSteps('service');
    clearBui();
    showChatBar(false);
    const wrap = document.createElement('div');
    wrap.className = 'fade';
    wrap.innerHTML = '<div class="section-label">Choose a service</div><div class="svc-list" id="svc-list"></div>';
    const list = wrap.querySelector('#svc-list');
    widgetConfig.services.slice(0, 6).forEach((svc, i) => {
      const btn = document.createElement('button');
      btn.className = 'svc-card';
      const dur = svc.durationMin ? `${svc.durationMin} min` : '';
      const price = svc.priceRange || '';
      const meta = [dur, price].filter(Boolean).join(' \u00B7 ');
      btn.innerHTML = `<div class="svc-icon">${SVC_ICONS[i % SVC_ICONS.length]}</div><div style="flex:1"><div class="svc-name">${svc.name}</div>${meta ? `<div class="svc-meta">${meta}</div>` : ''}</div><div class="svc-arrow">\u203A</div>`;
      btn.onclick = () => pickService(svc.name);
      list.appendChild(btn);
    });
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
    const wrap = document.createElement('div');
    wrap.className = 'fade';
    wrap.innerHTML = '<div class="section-label">Pick a date</div><div class="date-strip" id="dstrip"></div>';
    const strip = wrap.querySelector('#dstrip');
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const btn = document.createElement('button');
      btn.className = 'date-btn';
      btn.dataset.iso = iso;
      btn.innerHTML = `<div class="dday">${DAYS[d.getDay()]}</div><div class="dnum">${d.getDate()}</div><div class="dmon">${MONTHS[d.getMonth()]}</div>`;
      btn.onclick = () => pickDate(iso, btn, strip);
      strip.appendChild(btn);
    }
    const backRow = document.createElement('div');
    backRow.className = 'btn-row';
    const back = document.createElement('button');
    back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Back';
    back.onclick = () => { addMsg('\u2190 Back', 'u'); showServiceStep(); };
    backRow.appendChild(back);
    wrap.appendChild(backRow);
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
      addMsg(`No openings on that day. Try another date.`, 'a');
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
    const wrap = document.createElement('div');
    wrap.className = 'fade';
    wrap.innerHTML = `<div class="section-label">Pick a time <span style="font-size:10px;text-transform:none;font-weight:400;letter-spacing:0">(${tz})</span></div><div class="time-grid" id="tgrid"></div>`;
    const grid = wrap.querySelector('#tgrid');
    booking.slots.slice(0, 12).forEach((iso, i) => {
      const btn = document.createElement('button');
      btn.className = `time-btn${i === 0 ? ' sel' : ''}`;
      btn.textContent = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      btn.onclick = () => pickSlot(iso, btn, grid);
      grid.appendChild(btn);
    });
    const backRow = document.createElement('div');
    backRow.className = 'btn-row';
    const back = document.createElement('button');
    back.className = 'btn btn-ghost';
    back.textContent = '\u2190 Different day';
    back.onclick = () => { addMsg('\u2190 Different day', 'u'); showDateStep(); };
    backRow.appendChild(back);
    wrap.appendChild(backRow);
    buiEl.appendChild(wrap);
  }

  function pickSlot(iso, btnEl, grid) {
    grid.querySelectorAll('.time-btn').forEach(b => b.classList.remove('sel'));
    btnEl.classList.add('sel');
    booking.selectedSlotISO = iso; booking.step = 'details'; saveBooking();
    addMsg(new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), 'u');
    emit('slot_selected', { slotISO: iso });
    showDetailsStep();
  }

  function showDetailsStep() {
    renderSteps('details');
    clearBui();
    showChatBar(false);
    const wrap = document.createElement('div');
    wrap.className = 'fade';
    wrap.innerHTML = `
      <div class="section-label">Your details</div>
      <div class="form-wrap">
        <div class="field"><label>Full name</label><input id="f-name" type="text" placeholder="Jane Smith" value="${booking.customerName || ''}" autocomplete="name"/></div>
        <div class="field"><label>Email address</label><input id="f-email" type="email" placeholder="jane@example.com" value="${booking.customerEmail || ''}" autocomplete="email"/></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="d-back">\u2190</button>
        <button class="btn btn-primary grow" id="d-next">Review booking \u2192</button>
      </div>
    `;
    buiEl.appendChild(wrap);
    wrap.querySelector('#d-back').onclick = () => { addMsg('\u2190 Back', 'u'); showTimeStep(); };
    wrap.querySelector('#d-next').onclick = () => {
      const nameEl  = wrap.querySelector('#f-name');
      const emailEl = wrap.querySelector('#f-email');
      const name    = nameEl.value.trim();
      const email   = emailEl.value.trim();
      nameEl.classList.remove('err');
      emailEl.classList.remove('err');
      let ok = true;
      if (name.length < 2)                              { nameEl.classList.add('err');  nameEl.focus();  ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  { emailEl.classList.add('err'); if (ok) emailEl.focus(); ok = false; }
      if (!ok) return;
      booking.customerName  = name;
      booking.customerEmail = email;
      saveBooking();
      showConfirmStep();
    };
    setTimeout(() => wrap.querySelector('#f-name').focus(), 60);
  }

  function showConfirmStep() {
    booking.step = 'confirm'; saveBooking();
    renderSteps('confirm');
    clearBui();
    showChatBar(false);
    const dt = new Date(booking.selectedSlotISO);
    const dtLabel = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const wrap = document.createElement('div');
    wrap.className = 'fade';
    wrap.innerHTML = `
      <div class="section-label">Confirm your booking</div>
      <div class="summary">
        <div class="sum-row"><div class="sum-ic">\u2702\uFE0F</div><div><div class="sum-text">${booking.serviceName}</div><div class="sum-sub">Service</div></div></div>
        <div class="sum-row"><div class="sum-ic">\uD83D\uDCC5</div><div><div class="sum-text">${dtLabel}</div><div class="sum-sub">Date &amp; time</div></div></div>
        <div class="sum-row"><div class="sum-ic">\uD83D\uDC64</div><div><div class="sum-text">${booking.customerName}</div><div class="sum-sub">Name</div></div></div>
        <div class="sum-row"><div class="sum-ic">\uD83D\uDCE7</div><div><div class="sum-text">${booking.customerEmail}</div><div class="sum-sub">Confirmation sent here</div></div></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="c-back">\u2190</button>
        <button class="btn btn-primary grow" id="c-confirm">\u2713 Confirm Booking</button>
      </div>
    `;
    buiEl.appendChild(wrap);
    wrap.querySelector('#c-back').onclick = () => { addMsg('\u2190 Back', 'u'); showDetailsStep(); };
    const confirmBtn = wrap.querySelector('#c-confirm');
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Booking\u2026';
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
  }

  function showSuccess(slotISO, svc, name, email) {
    renderSteps('');
    clearBui();
    showChatBar(false);
    const dt = new Date(slotISO);
    const dtLabel = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '\n' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const wrap = document.createElement('div');
    wrap.className = 'success fade';
    wrap.innerHTML = `
      <div class="success-ring">\u2705</div>
      <div class="success-title">You're booked!</div>
      <div class="success-sub">Confirmation sent to<br><strong>${email}</strong></div>
      <div class="success-card"><strong>${svc}</strong><br>\uD83D\uDCC5 ${dtLabel}<br>\uD83D\uDC64 ${name}</div>
    `;
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-ghost';
    doneBtn.textContent = 'Done';
    doneBtn.style.width = '100%';
    doneBtn.onclick = () => { msgsEl.innerHTML = ''; clearBui(); addMsg(greeting, 'a'); showHome(); };
    wrap.appendChild(doneBtn);
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
      const r    = await fetch(`${apiBase}/api/chat`, { method: 'POST', headers: {'Content-Type':'application/json','x-widget-token': widgetToken}, body: JSON.stringify({ businessId, sessionId, message: msg }) });
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
      if      (step === 'date')    showDateStep();
      else if (step === 'time'  && booking.slots.length) showTimeStep();
      else if (step === 'details') showDetailsStep();
      else if (step === 'confirm') showConfirmStep();
      else                         showServiceStep();
    } else {
      showHome();
    }
  });

  bubble.onclick = () => {
    const open = panel.classList.contains('open');
    panel.classList.toggle('open', !open);
    nudge.classList.toggle('hidden', !open);
    if (!open) { panel.classList.add('open'); chatIn.focus(); }
  };

  chatSend.onclick  = handleSend;
  chatIn.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
})();
