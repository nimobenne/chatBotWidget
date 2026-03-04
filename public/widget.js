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

  const bookingKey = `ai_receptionist_booking_${businessId}_${sessionId}`;
  const initialBooking = {
    active: false,
    step: 'service',
    serviceName: '',
    dateISO: '',
    selectedSlotISO: '',
    customerName: '',
    customerEmail: '',
    slots: []
  };
  let booking = loadBooking();

  function loadBooking() {
    try {
      const raw = localStorage.getItem(bookingKey);
      return raw ? { ...initialBooking, ...JSON.parse(raw) } : { ...initialBooking };
    } catch {
      return { ...initialBooking };
    }
  }

  function saveBooking() {
    localStorage.setItem(bookingKey, JSON.stringify(booking));
  }

  function resetBooking() {
    booking = { ...initialBooking };
    saveBooking();
  }

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
    .panel { display:none; width:340px;height:520px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;font-family:Arial,sans-serif;flex-direction:column }
    .panel.open { display:flex }
    .head { padding:12px 14px;background:${accent};color:#fff;font-weight:600;display:flex;justify-content:space-between;align-items:center }
    .minimize { background:transparent;border:0;color:#fff;cursor:pointer;font-size:18px;padding:0 }
    .msgs { flex:1;overflow:auto;padding:10px;background:#f8fafc }
    .row { margin:8px 0; display:flex }
    .u{justify-content:flex-end}.a{justify-content:flex-start}
    .msg{max-width:82%;padding:8px 10px;border-radius:10px;font-size:14px;line-height:1.35;white-space:pre-wrap}
    .u .msg{background:${accent};color:#fff}.a .msg{background:#e2e8f0;color:#111}
    .quick { display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-top:1px solid #e5e7eb;background:#fff }
    .quick button { padding:7px 10px;border-radius:16px;border:1px solid ${accent};background:#fff;color:${accent};font-size:12px;cursor:pointer }
    .quick button.primary { background:${accent};color:#fff }
    .composer{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb}
    .input{flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px}
    .send{padding:8px 12px;border:0;border-radius:8px;background:${accent};color:#fff;cursor:pointer}
    .send:disabled{opacity:.6;cursor:not-allowed}
    .loading{font-size:12px;color:#6b7280;text-align:center;padding:4px}
  `;

  const bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.textContent = icon;
  bubble.setAttribute('aria-label', 'Open chat');

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = '<div class="head"><span>Chat with us</span><button class="minimize" aria-label="Minimize">−</button></div><div class="msgs"></div><div class="quick"></div><div class="composer"><input class="input" placeholder="Type a message..."/><button class="send">Send</button></div>';

  shadow.appendChild(style);
  shadow.appendChild(panel);
  shadow.appendChild(bubble);

  const msgs = panel.querySelector('.msgs');
  const quick = panel.querySelector('.quick');
  const input = panel.querySelector('.input');
  const send = panel.querySelector('.send');
  const minimize = panel.querySelector('.minimize');

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

  function setLoading(on) {
    send.disabled = on;
    const existing = msgs.querySelector('.loading');
    if (existing) existing.remove();
    if (on) {
      const l = document.createElement('div');
      l.className = 'loading';
      l.textContent = 'Typing...';
      msgs.appendChild(l);
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  function setQuickButtons(items) {
    quick.innerHTML = '';
    items.forEach((item) => {
      const b = document.createElement('button');
      b.textContent = item.label;
      if (item.primary) b.className = 'primary';
      b.onclick = item.onClick;
      quick.appendChild(b);
    });
  }

  function normalizeService(text) {
    const t = text.toLowerCase();
    if (t.includes('classic')) return 'Classic Haircut';
    if (t.includes('fade')) return 'Skin Fade';
    if (t.includes('beard')) return 'Beard Trim';
    if (t.includes('haircut') || t.includes('cut')) return 'Classic Haircut';
    return '';
  }

  function parseDateTime(text) {
    const t = text.toLowerCase();
    const now = new Date();
    const d = new Date();
    if (t.includes('tomorrow') || t.includes('tmrw')) d.setDate(now.getDate() + 1);
    else if (t.includes('today')) d.setDate(now.getDate());
    else {
      const date = text.match(/(\d{4}-\d{2}-\d{2})/);
      if (date) {
        const parsed = new Date(`${date[1]}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) d.setTime(parsed.getTime());
      }
    }
    const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!time) return null;
    let hh = Number(time[1]);
    const mm = Number(time[2] || '0');
    const ap = time[3];
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    d.setHours(hh, mm, 0, 0);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function bookingButtons() {
    if (!booking.active) {
      setQuickButtons([
        { label: 'Book Appointment', primary: true, onClick: startBooking },
        { label: 'Hours', onClick: () => sendToChat('What are your hours?') },
        { label: 'Services', onClick: () => sendToChat('What services do you offer?') },
        { label: 'Contact', onClick: () => sendToChat('How can I contact you?') }
      ]);
      return;
    }
    if (booking.step === 'service') {
      setQuickButtons([
        { label: 'Classic Haircut', primary: true, onClick: () => handleBookingInput('Classic Haircut') },
        { label: 'Skin Fade', onClick: () => handleBookingInput('Skin Fade') },
        { label: 'Beard Trim', onClick: () => handleBookingInput('Beard Trim') },
        { label: 'Switch to chat', onClick: switchToChat }
      ]);
      return;
    }
    if (booking.step === 'datetime') {
      setQuickButtons([
        { label: 'Tomorrow 3:00 PM', primary: true, onClick: () => handleBookingInput('tomorrow 3pm') },
        { label: 'Tomorrow 4:00 PM', onClick: () => handleBookingInput('tomorrow 4pm') },
        { label: 'Tomorrow 5:00 PM', onClick: () => handleBookingInput('tomorrow 5pm') },
        { label: 'Switch to chat', onClick: switchToChat }
      ]);
      return;
    }
    if (booking.step === 'pickSlot') {
      setQuickButtons([
        ...booking.slots.slice(0, 5).map((iso, idx) => ({
          label: new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          primary: idx === 0,
          onClick: () => handleBookingInput(iso)
        })),
        { label: 'Different day/time', onClick: () => {
          booking.step = 'datetime';
          booking.slots = [];
          saveBooking();
          addMsg('No problem - what date and time would you prefer?', 'a');
          bookingButtons();
        } }
      ]);
      return;
    }
    if (booking.step === 'name' || booking.step === 'email') {
      setQuickButtons([
        { label: 'Switch to chat', onClick: switchToChat },
        { label: 'Cancel booking', onClick: cancelBooking }
      ]);
      return;
    }
    setQuickButtons([{ label: 'Book Appointment', primary: true, onClick: startBooking }]);
  }

  function switchToChat() {
    booking.active = false;
    saveBooking();
    addMsg('Switched to chat mode. Ask me anything.', 'a');
    bookingButtons();
  }

  function cancelBooking() {
    resetBooking();
    addMsg('Booking canceled. You can start again anytime.', 'a');
    bookingButtons();
  }

  async function checkAvailability(serviceName, dateISO) {
    const res = await fetch(`${apiBase}/api/booking/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, serviceName, date: dateISO })
    });
    return res.json();
  }

  async function createBooking() {
    const res = await fetch(`${apiBase}/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        serviceName: booking.serviceName,
        startTimeISO: booking.selectedSlotISO,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail
      })
    });
    return res.json();
  }

  function startBooking() {
    booking.active = true;
    booking.step = 'service';
    booking.serviceName = '';
    booking.dateISO = '';
    booking.selectedSlotISO = '';
    booking.customerName = '';
    booking.customerEmail = '';
    booking.slots = [];
    saveBooking();
    addMsg('Great - what service would you like? (Classic Haircut, Skin Fade, or Beard Trim)', 'a');
    bookingButtons();
  }

  async function handleBookingInput(text) {
    const message = String(text || '').trim();
    if (!message) return;
    addMsg(message, 'u');

    if (booking.step === 'service') {
      const mapped = normalizeService(message);
      if (!mapped) {
        addMsg('Please pick one: Classic Haircut, Skin Fade, or Beard Trim.', 'a');
        bookingButtons();
        return;
      }
      booking.serviceName = mapped;
      booking.step = 'datetime';
      saveBooking();
      addMsg(`Perfect. What date and time works for your ${mapped}?`, 'a');
      bookingButtons();
      return;
    }

    if (booking.step === 'datetime') {
      const dt = parseDateTime(message);
      if (!dt) {
        addMsg('Please share a date/time like "tomorrow 4pm".', 'a');
        bookingButtons();
        return;
      }
      const dateISO = dt.toISOString().split('T')[0];
      setLoading(true);
      const data = await checkAvailability(booking.serviceName, dateISO);
      setLoading(false);
      if (data.error) {
        addMsg(data.error, 'a');
        bookingButtons();
        return;
      }
      booking.dateISO = dateISO;
      booking.slots = data.slots || [];
      const match = booking.slots.find((iso) => {
        const s = new Date(iso);
        return s.getHours() === dt.getHours() && s.getMinutes() === dt.getMinutes();
      });
      if (match) {
        booking.selectedSlotISO = match;
        booking.step = 'name';
        saveBooking();
        addMsg(`Great, ${new Date(match).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} is available. What's your full name?`, 'a');
        bookingButtons();
        return;
      }
      if (!booking.slots.length) {
        addMsg('No slots are open for that day. Want to try another date?', 'a');
        bookingButtons();
        return;
      }
      booking.step = 'pickSlot';
      saveBooking();
      addMsg('That exact time is unavailable. Please choose one of these open times:', 'a');
      bookingButtons();
      return;
    }

    if (booking.step === 'pickSlot') {
      const selected = booking.slots.includes(message) ? message : '';
      if (!selected) {
        addMsg('Please pick one of the time buttons.', 'a');
        bookingButtons();
        return;
      }
      booking.selectedSlotISO = selected;
      booking.step = 'name';
      saveBooking();
      addMsg("Awesome. What's your full name?", 'a');
      bookingButtons();
      return;
    }

    if (booking.step === 'name') {
      booking.customerName = message;
      booking.step = 'email';
      saveBooking();
      addMsg('Thanks. What email should we send your confirmation to?', 'a');
      bookingButtons();
      return;
    }

    if (booking.step === 'email') {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message);
      if (!emailOk) {
        addMsg('That email looks invalid. Please try again.', 'a');
        bookingButtons();
        return;
      }
      booking.customerEmail = message;
      setLoading(true);
      const data = await createBooking();
      setLoading(false);
      if (data.error) {
        addMsg(`Sorry, booking failed: ${data.error}`, 'a');
        bookingButtons();
        return;
      }
      addMsg(`Booked! You're set for ${new Date(booking.selectedSlotISO).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Confirmation was sent to ${booking.customerEmail}.`, 'a');
      resetBooking();
      bookingButtons();
      return;
    }
  }

  async function sendToChat(text) {
    const message = String(text || '').trim();
    if (!message) return;
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
      addMsg(data.error || data.message || 'OK', 'a');
      bookingButtons();
    } catch {
      setLoading(false);
      addMsg('Network error. Please try again.', 'a');
      bookingButtons();
    }
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    if (booking.active) {
      handleBookingInput(text);
    } else {
      sendToChat(text);
    }
  }

  addMsg(greeting, 'a');
  if (booking.active) {
    addMsg('Welcome back — we can continue your booking.', 'a');
  }
  bookingButtons();

  bubble.onclick = () => {
    const open = panel.classList.contains('open');
    panel.classList.toggle('open', !open);
    if (!open) input.focus();
  };
  minimize.onclick = () => panel.classList.remove('open');
  send.onclick = handleSend;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
})();
