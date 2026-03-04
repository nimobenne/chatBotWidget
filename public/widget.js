(function () {
  const script = document.currentScript;
  if (!script) return;

  const businessId = script.getAttribute('data-business') || 'demo_barber';
  const position = script.getAttribute('data-position') || 'bottom-right';
  const accent = script.getAttribute('data-accent') || '#111827';
  const icon = script.getAttribute('data-icon') || '💬';
  const greeting = script.getAttribute('data-greeting') || 'Hi! How can I help you today?';
  const apiBase = new URL(script.src, window.location.href).origin;
  const sessionKey = `ai_receptionist_session_${businessId}`;
  const sessionId = localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, sessionId);

  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.zIndex = '2147483000';
  if (position.includes('bottom')) root.style.bottom = '20px';
  if (position.includes('right')) root.style.right = '20px';
  if (position.includes('left')) root.style.left = '20px';
  document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .bubble { width:56px;height:56px;border-radius:999px;background:${accent};color:#fff;border:0;cursor:pointer;font-size:24px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
    .panel { display:none; width:340px;height:500px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;font-family:Arial,sans-serif;flex-direction:column }
    .panel.open { display: flex }
    .head { padding:12px 14px;background:${accent};color:white;font-weight:600;display:flex;justify-content:space-between;align-items:center;flex-shrink:0 }
    .minimize { background:transparent;border:0;color:white;cursor:pointer;font-size:18px;padding:0 }
    .msgs { flex:1;overflow:auto;padding:10px;background:#f8fafc;min-height:200px }
    .row { margin:8px 0; display:flex }
    .u{justify-content:flex-end}.a{justify-content:flex-start}
    .msg{max-width:80%;padding:8px 10px;border-radius:10px;font-size:14px;line-height:1.35}
    .u .msg{background:${accent};color:#fff}.a .msg{background:#e2e8f0;color:#111}
    .composer{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb;flex-shrink:0}
    .input{flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px}
    .send{padding:8px 12px;border:0;border-radius:8px;background:${accent};color:white;cursor:pointer}
    .send:disabled{opacity:0.6;cursor:not-allowed}
    .loading{font-size:12px;color:#6b7280;text-align:center;padding:4px}
    .spinner{display:inline-block;width:12px;height:12px;border:2px solid #e5e7eb;border-top-color:${accent};border-radius:50%;animation:spin .8s linear infinite;margin-right:4px;vertical-align:middle}
    @keyframes spin{to{transform:rotate(360deg)}}
    .quick-options { display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#fff;border-bottom:1px solid #e5e7eb }
    .quick-btn { padding:8px 14px;border:1px solid ${accent};background:${accent};color:#fff;border-radius:20px;font-size:13px;cursor:pointer }
    .quick-btn:hover { opacity:0.9 }
  `;

  const bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.textContent = icon;
  bubble.setAttribute('aria-label', 'Open chat');

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="head"><span>Chat with us</span><button class="minimize" aria-label="Minimize">−</button></div>
    <div class="msgs"></div>
    <div class="quick-options"></div>
    <div class="composer"><input class="input" placeholder="Type a message..."/><button class="send">Send</button></div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(bubble);

  const msgs = panel.querySelector('.msgs');
  const input = panel.querySelector('.input');
  const send = panel.querySelector('.send');
  const minimize = panel.querySelector('.minimize');
  const quickOptions = panel.querySelector('.quick-options');

  const mainOptions = [
    { label: '📅 Book Appointment', action: 'I want to book an appointment' },
    { label: '🕐 Hours', action: 'What are your hours?' },
    { label: '✂️ Services', action: 'What services do you offer?' },
    { label: '📞 Contact', action: 'How can I contact you?' }
  ];

  function addMsg(text, who) {
    const row = document.createElement('div');
    row.className = 'row ' + who;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg';
    msgDiv.textContent = text;
    row.appendChild(msgDiv);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showQuickOptions(options) {
    quickOptions.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quick-btn';
      btn.textContent = opt.label;
      btn.onclick = () => sendMessage(opt.action);
      quickOptions.appendChild(btn);
    });
  }

  addMsg(greeting, 'a');
  showQuickOptions(mainOptions);

  bubble.onclick = () => panel.classList.toggle('open', !panel.classList.contains('open'));
  minimize.onclick = () => panel.classList.remove('open');

  function setLoading(isLoading) {
    send.disabled = isLoading;
    if (isLoading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.innerHTML = '<span class="spinner"></span>Typing...';
      msgs.appendChild(loading);
      msgs.scrollTop = msgs.scrollHeight;
    } else {
      const loading = msgs.querySelector('.loading');
      if (loading) loading.remove();
    }
  }

  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    
    const message = text.trim();
    input.value = '';
    addMsg(message, 'u');
    setLoading(true);
    
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message })
      });
      
      const data = await res.json();
      setLoading(false);
      
      if (data.error) {
        addMsg(data.error, 'a');
      } else {
        addMsg(data.message || 'OK', 'a');
      }
      
      // Show main options after each response
      setTimeout(() => showQuickOptions(mainOptions), 100);
      
    } catch (e) {
      setLoading(false);
      addMsg('Error. Try again.', 'a');
      showQuickOptions(mainOptions);
    }
  }

  send.onclick = () => sendMessage(input.value);
  input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(input.value); };
})();
