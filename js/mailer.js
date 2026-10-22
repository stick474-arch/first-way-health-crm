/* Aetherium — email delivery.
   Without setup: opens the message ready to send in Gmail / Outlook / the mail app.
   With EmailJS (free, sends from your own Gmail, no domain needed): sends directly from the app.
   EmailJS keys live in the workspace settings (Settings → Email); the public key is designed to be public. */
const Mailer = (() => {
  const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
  const APP_URL = 'https://stick474-arch.github.io/first-way-health-crm/';

  const cfg = () => Store.settings.email || {};
  const configured = () => !Cloud.demo && !!(cfg().serviceId && cfg().templateId && cfg().publicKey);
  const splitTo = (to) => [...new Set(String(to || '').split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^\S+@\S+\.\S+$/.test(s)))];

  async function sendOne(to, subject, body) {
    const me = Store.currentUser();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg().serviceId,
        template_id: cfg().templateId,
        user_id: cfg().publicKey,
        template_params: {
          to_email: to, subject, message: body,
          from_name: `${me?.name || 'Aetherium'} · ${Store.settings.companyName || 'Aetherium'}`,
          reply_to: me?.email || Cloud.user?.email || '',
          app_url: APP_URL,
        },
      }),
    });
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `EmailJS error ${res.status}`);
  }

  // Sends directly when EmailJS is set up; returns { sent: n, failed: [emails] }
  async function send({ to, subject, body }) {
    const list = splitTo(to);
    if (!list.length) throw new Error('No valid email address');
    const failed = [];
    let sent = 0;
    for (const addr of list) {
      try { await sendOne(addr, subject, body); sent++; } catch (e) { console.error(e); failed.push(addr); }
    }
    return { sent, failed };
  }

  // Opens the message in the person's mail (no setup needed)
  function compose({ to, subject, body, client }) {
    const e = encodeURIComponent;
    const pref = client || (() => { try { return localStorage.getItem('fwh-mail-client') || 'gmail'; } catch { return 'gmail'; } })();
    let url;
    if (pref === 'outlook') url = `https://outlook.office.com/mail/deeplink/compose?to=${e(to)}&subject=${e(subject)}&body=${e(body)}`;
    else if (pref === 'mailto') url = `mailto:${splitTo(to).map(e).join(',')}?subject=${e(subject)}&body=${e(body)}`;
    else url = `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}&su=${e(subject)}&body=${e(body)}`;
    if (pref === 'mailto') window.location.href = url; else window.open(url, '_blank', 'noopener');
  }

  // Best available delivery: direct when configured, otherwise open in the mail app
  async function deliver(msg, { quiet = false } = {}) {
    if (configured()) {
      const r = await send(msg);
      if (!quiet) {
        if (r.failed.length) UI.toast(`Sent to ${r.sent}; failed: ${r.failed.join(', ')}`, 'error', { duration: 8000 });
        else UI.toast(`Email sent to ${U.plural(r.sent, 'person', 'people')}`, 'success');
      }
      return r;
    }
    compose(msg);
    return { sent: 0, opened: true, failed: [] };
  }

  const taskLink = () => `${APP_URL}#/tasks`;

  return { configured, send, compose, deliver, splitTo, taskLink, APP_URL };
})();
