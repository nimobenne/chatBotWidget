(function () {
  const script = document.currentScript;
  if (!script) return;

  const businessId = script.getAttribute('data-business') || 'demo_barber';
  const position = script.getAttribute('data-position') || 'bottom-right';
  const accent = script.getAttribute('data-accent') || '#111827';
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
    .panel { display:none; width:340px;height:460px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;font-family:Arial,sans-serif }
    .head { padding:12px 14px;background:${accent};color:white;font-weight:600 }
    .msgs { height:340px;overflow:auto;padding:10px;background:#f8fafc }
    .row { margin:8px 0; display:flex }
    .u{justify-content:flex-end}.a{justify-content:flex-start}
    .msg{max-width:80%;padding:8px 10px;border-radius:10px;font-size:14px;line-height:1.35}
    .u .msg{background:${accent};color:#fff}.a .msg{background:#e2e8f0;color:#111}
    .composer{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb}
    .input{flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px}
    .send{padding:8px 12px;border:0;border-radius:8px;background:${accent};color:white;cursor:pointer}
  `;

  const bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.textContent = '✂';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = '<div class="head">Chat with us</div><div class="msgs"></div><div class="composer"><input class="input" placeholder="Type a message..."/><button class="send">Send</button></div>';

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(bubble);

  const msgs = panel.querySelector('.msgs');
  const input = panel.querySelector('.input');
  const send = panel.querySelector('.send');

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

  addMsg('Hi! I can help with services, hours, and booking.', 'a');

  bubble.onclick = () => {
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
  };

  async function sendMessage() {
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    addMsg(message, 'u');
    send.disabled = true;
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message })
      });
      const data = await res.json();
      addMsg(data.message || data.error || 'Sorry, I could not respond.', 'a');
    } catch {
      addMsg('Network error. Please try again.', 'a');
    } finally {
      send.disabled = false;
    }
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMessage(); });
})();
