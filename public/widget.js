(function () {
  const script = document.currentScript;
  if (!script) return;

  const businessId = script.getAttribute('data-business') || 'demo_barber';
  const position = script.getAttribute('data-position') || 'bottom-right';
  const accent = script.getAttribute('data-accent') || '#111827';
  const icon = script.getAttribute('data-icon') || '💬';
  const greeting = script.getAttribute('data-greeting') || 'Hi! I can help with services, hours, and booking.';
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
    .quick-btn { padding:8px 12px;border:1px solid ${accent};background:${accent};color:#fff;border-radius:20px;font-size:13px;cursor:pointer }
    .quick-btn.secondary { background:#fff;color:${accent} }
    .quick-btn:hover { opacity:0.9 }
    .form-group { padding:10px }
    .form-group label { display:block;font-size:13px;margin-bottom:4px;color:#374151 }
    .form-group input { width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box }
    .form-group button { width:100%;padding:10px;background:${accent};color:#fff;border:0;border-radius:6px;cursor:pointer;margin-top:8px }
    .success-check { font-size:40px;text-align:center;padding:20px }
  `;

  const bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.textContent = icon;
  bubble.setAttribute('aria-label', 'Open chat');

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="head"><span>Chat with us</span><button class="minimize" aria-label="Minimize chat">−</button></div>
    <div class="msgs"></div>
    <div class="quick-options"></div>
    <div class="composer"><input class="input" placeholder="Type a message..." aria-label="Message input"/><button class="send" aria-label="Send message">Send</button></div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(bubble);

  const msgs = panel.querySelector('.msgs');
  const input = panel.querySelector('.input');
  const send = panel.querySelector('.send');
  const minimize = panel.querySelector('.minimize');
  const quickOptions = panel.querySelector('.quick-options');

  let currentStep = 'start';

  function showQuickOptions(options) {
    quickOptions.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quick-btn' + (opt.secondary ? ' secondary' : '');
      btn.textContent = opt.label;
      btn.onclick = () => {
        quickOptions.innerHTML = '';
        sendMessage(opt.action);
      };
      quickOptions.appendChild(btn);
    });
  }

  function showQuickReply(label, action) {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.textContent = label;
    btn.onclick = () => {
      btn.remove();
      sendMessage(action);
    };
    quickOptions.appendChild(btn);
  }

  const mainOptions = [
    { label: '📅 Book Appointment', action: 'I want to book an appointment' },
    { label: '🕐 Hours', action: 'What are your hours?' },
    { label: '✂️ Services', action: 'What services do you offer?' },
    { label: '📞 Contact', action: 'How can I contact you?' }
  ];

  function addMsg(text, who) {
    const row = document.createElement('div');
    row.className = `row ${who}`;
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = text;
    row.appendChild(msg);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
  }

  addMsg(greeting, 'a');
  showQuickOptions(mainOptions);

  bubble.onclick = () => {
    const open = panel.classList.contains('open');
    panel.classList.toggle('open', !open);
    if (!open) input.focus();
  };

  minimize.onclick = () => {
    panel.classList.remove('open');
  };

  function setLoading(isLoading) {
    send.disabled = isLoading;
    if (isLoading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.id = 'loading-indicator';
      loading.innerHTML = '<span class="spinner"></span>Typing...';
      msgs.appendChild(loading);
      msgs.scrollTop = msgs.scrollHeight;
    } else {
      const loading = msgs.querySelector('#loading-indicator');
      if (loading) loading.remove();
    }
  }

  async function sendMessage(message) {
    if (!message || (typeof message === 'string' && !message.trim())) return;
    const text = typeof message === 'string' ? message : input.value.trim();
    if (!text) return;
    
    input.value = '';
    addMsg(text, 'u');
    setLoading(true);
    
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message: text })
      });
      const data = await res.json();
      setLoading(false);
      
      if (data.error) {
        addMsg(data.error, 'a');
        showQuickOptions(mainOptions);
      } else {
        const response = data.message || '';
        addMsg(response, 'a');
        
        // Show context-aware quick replies
        quickOptions.innerHTML = '';
        
        if (response.toLowerCase().includes('what service')) {
          showQuickReply('Classic Haircut', 'Classic Haircut');
          showQuickReply('Skin Fade', 'Skin Fade');
          showQuickReply('Beard Trim', 'Beard Trim');
        } else if (response.toLowerCase().includes('what date') || response.toLowerCase().includes('what time')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          showQuickReply(tomorrowStr + ' 4pm', 'Tomorrow at 4pm');
          showQuickReply(tomorrowStr + ' 5pm', 'Tomorrow at 5pm');
          showQuickReply('Pick my own time', 'Let me pick a time');
        } else         if (response.toLowerCase().includes('name and email') || response.toLowerCase().includes('confirm')) {
          const inputArea = document.createElement('div');
          inputArea.className = 'form-group';
          inputArea.style.padding = '10px';
          inputArea.innerHTML = `
            <input class="name-input" placeholder="Your name" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px;box-sizing:border-box"/>
            <input class="email-input" placeholder="Your email" type="email" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px;box-sizing:border-box"/>
            <button class="confirm-btn" style="width:100%;padding:10px;background:${accent};color:#fff;border:0;border-radius:6px;cursor:pointer">Confirm Booking</button>
            <p style="font-size:12px;color:#6b7280;margin:8px 0 0;text-align:center">Or type your name and email below</p>
          `;
          quickOptions.appendChild(inputArea);
          
          const nameInput = inputArea.querySelector('.name-input');
          const emailInput = inputArea.querySelector('.email-input');
          const confirmBtn = inputArea.querySelector('.confirm-btn');
          
          confirmBtn.onclick = (e) => {
            e.stopPropagation();
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            if (name && email) {
              sendMessage(`My name is ${name} and my email is ${email}`);
            } else {
              alert('Please enter both name and email');
            }
          };
        } else if (response.includes('✅') || response.toLowerCase().includes('confirmed')) {
          showQuickReply('Book another', 'I want to book another appointment');
          showQuickReply('Done', 'Thank you');
        } else {
          showQuickOptions(mainOptions);
        }
      }
    } catch {
      setLoading(false);
      addMsg('Network error. Please try again.', 'a');
      showQuickOptions(mainOptions);
    }
  }

  send.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMessage(); });
})();
