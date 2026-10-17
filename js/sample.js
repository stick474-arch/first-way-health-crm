/* First Way Health CRM — realistic sample data, dated relative to today so it never looks stale. */
const Sample = (() => {
  function build(yourName) {
    const d = Store.defaults();
    const t = U.today();
    const day = (n) => U.addDays(t, n);
    const at = (n, hh = 10, mm = 0) => `${day(n)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const stamp = (n) => at(n, 9, 0);
    const mk = (coll, obj, created = -60) => {
      const rec = { id: U.uid(Store.PREFIX[coll]), createdAt: stamp(created), updatedAt: stamp(created), ...obj };
      d[coll].push(rec);
      return rec;
    };

    // Team
    const me = mk('users', { name: yourName || 'You', email: '', role: 'Founder & CEO' });
    const jordan = mk('users', { name: 'Jordan Ellis', email: 'jordan@firstwayhealth.com', role: 'Business Development' });
    const taylor = mk('users', { name: 'Taylor Brooks', email: 'taylor@firstwayhealth.com', role: 'Operations' });
    d.settings.currentUserId = me.id;

    // Tags — "Group: value" keeps the list short and searchable
    const tg = {};
    [['Interest', 'Care coordination', 'teal'], ['Interest', 'Wellness program', 'green'], ['Interest', 'Remote monitoring', 'cyan'],
      ['Role', 'Decision maker', 'red'], ['Role', 'Champion', 'violet'], ['Role', 'Influencer', 'blue'],
      ['Segment', 'Small practice', 'amber'], ['Segment', 'Mid-size employer', 'orange'],
      ['Expertise', 'Finance', 'slate'], ['Expertise', 'Clinical', 'pink']]
      .forEach(([group, name, color]) => { tg[name] = mk('tags', { group, name, color }).id; });

    // Organizations
    const org = (name, type, industry, size, extra = {}) => mk('organizations', { name, type, industry, size, website: '', phone: '', address: '', ownerId: me.id, tags: [], notes: '', ...extra });
    const bright = org('Brightwater Family Clinic', 'Client', 'Primary care clinic', '11–50', { website: 'brightwaterclinic.example', address: 'Austin, TX', tags: [tg['Small practice']], notes: 'First signed client. Two locations; second one opening in Q1.' });
    const north = org('Northside Employers Alliance', 'Prospect', 'Employer (wellness benefits)', '201–1,000', { ownerId: jordan.id, address: 'Dallas, TX', tags: [tg['Mid-size employer']] });
    const summit = org('Summit Physical Therapy', 'Prospect', 'Specialty practice', '11–50', { address: 'Round Rock, TX', tags: [tg['Small practice']] });
    const harbor = org('Harborview Senior Living', 'Lead', 'Senior living', '51–200', { ownerId: jordan.id, address: 'San Antonio, TX' });
    const mesa = org('Mesa Freight & Logistics', 'Lead', 'Employer (wellness benefits)', '201–1,000', { ownerId: jordan.id, address: 'Houston, TX', tags: [tg['Mid-size employer']] });
    const carebridge = org('CareBridge Home Health', 'Partner', 'Home health', '51–200', { ownerId: taylor.id, notes: 'Co-referral agreement under discussion.' });
    const lumen = org('Lumen Health Network', 'Partner', 'Other', '1–10', { notes: 'Referral network of independent practices.' });
    const pinecrest = org('Pinecrest Capital', 'Investor', 'Other', '1–10', { notes: 'Led pre-seed round.' });

    // Contacts
    const con = (firstName, lastName, title, orgId, type, { created = -50, ...extra } = {}) => mk('contacts', {
      firstName, lastName, title, orgId, type, email: `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
      phone: '', linkedin: '', priority: 'B', source: 'Referral', ownerId: me.id, tags: [], cadenceDays: null, notes: '', board: null, ...extra,
    }, created);

    const maria = con('Maria', 'Gonzalez', 'Practice Manager', bright.id, 'Client', { priority: 'A', tags: [tg['Champion'], tg['Care coordination']], notes: 'Prefers calls before 10am. Day-to-day owner of the program.' });
    const samuel = con('Samuel', 'Okafor', 'Medical Director', bright.id, 'Client', { priority: 'A', tags: [tg['Decision maker']] });
    const rachel = con('Rachel', 'Kim', 'HR Director', north.id, 'Prospect', { priority: 'A', source: 'Event / conference', ownerId: jordan.id, tags: [tg['Champion'], tg['Wellness program']] });
    const tom = con('Tom', 'Becker', 'CFO', north.id, 'Prospect', { priority: 'B', source: 'Event / conference', ownerId: jordan.id, tags: [tg['Decision maker']] });
    const olivia = con('Olivia', 'Chen', 'Owner', summit.id, 'Prospect', { priority: 'B', source: 'LinkedIn', tags: [tg['Decision maker'], tg['Remote monitoring']] });
    const daniel = con('Daniel', 'Ruiz', 'Executive Director', harbor.id, 'Lead', { priority: 'B', source: 'Website', ownerId: jordan.id, created: -9 });
    const aisha = con('Aisha', 'Patel', 'Benefits Manager', mesa.id, 'Lead', { priority: 'C', source: 'Cold outreach', ownerId: jordan.id, created: -20, tags: [tg['Influencer']] });
    const grace = con('Grace', 'Thompson', 'Partnerships Lead', carebridge.id, 'Partner', { source: 'Partner', ownerId: taylor.id });
    const victor = con('Victor', 'Alvarez', 'Founder', lumen.id, 'Referral Source', { priority: 'A', source: 'Board introduction' });
    const hannah = con('Hannah', 'Weiss', 'Partner', pinecrest.id, 'Investor', { priority: 'A', source: 'Referral', tags: [tg['Finance']] });

    const board = (role, committees, termStart, termEnd, extra = {}) => ({ role, committees, termStart, termEnd, voting: true, independent: false, coi: '', ...extra });
    const dana = con('Dana', 'Whitfield', 'Retired hospital COO', '', 'Board Member', { priority: 'A', source: 'Board introduction', tags: [tg['Clinical']],
      board: board('Chair', ['Governance & Nominating'], day(-400), day(700), { independent: true }) });
    const marcus = con('Marcus', 'Lee', 'Co-founder & COO, First Way Health', '', 'Board Member', { priority: 'A', source: 'Other',
      board: board('Secretary', [], day(-400), day(700)) });
    const priya = con('Priya', 'Raman', 'CFO, regional health system', '', 'Board Member', { priority: 'A', source: 'Board introduction', tags: [tg['Finance']],
      board: board('Treasurer', ['Audit & Finance', 'Compensation'], day(-700), day(55), { independent: true, coi: `${day(-200)}: Disclosed advisory role at a regional payer; recuses from payer contract votes.` }) });
    const robert = con('Robert', 'Nguyen', 'Partner, Pinecrest Capital', pinecrest.id, 'Board Member', { priority: 'A', source: 'Referral', tags: [tg['Finance']],
      board: board('Director', ['Audit & Finance', 'Compensation'], day(-300), day(800), { coi: `${day(-300)}: Investor designee (Pinecrest Capital).` }) });
    const elena = con('Elena', 'Morales', 'MD, Internal Medicine', '', 'Advisor', { priority: 'B', source: 'Board introduction', tags: [tg['Clinical']],
      board: board('Advisor', ['Clinical Quality'], day(-200), day(530), { voting: false, independent: true }) });

    // Deals
    const deal = (name, orgId, contactId, stage, value, expectedClose, ownerId, { changed = -10, ...extra } = {}) => mk('deals', {
      name, orgId, contactId, stage, value, expectedClose, ownerId, notes: '', lostReason: '', stageChangedAt: stamp(changed),
      closedAt: stage === 'won' || stage === 'lost' ? day(changed) : '', ...extra,
    }, -55);
    deal('Brightwater care coordination (annual)', bright.id, samuel.id, 'won', 36000, day(-45), me.id, { changed: -45 });
    deal('Brightwater second location', bright.id, maria.id, 'proposal', 18000, day(25), me.id, { changed: -6 });
    deal('Northside employee wellness program', north.id, rachel.id, 'negotiation', 72000, day(21), jordan.id, { changed: -4 });
    deal('Summit PT remote follow-up program', summit.id, olivia.id, 'meeting', 15000, day(35), me.id, { changed: -12 });
    deal('Harborview resident care pilot', harbor.id, daniel.id, 'qualified', 24000, day(50), jordan.id, { changed: -3 });
    deal('Mesa Freight wellness screening', mesa.id, aisha.id, 'lead', 12000, day(70), jordan.id, { changed: -18 });
    deal('Riverside Dental onboarding package', '', '', 'lost', 9000, day(-30), me.id, { changed: -30, lostReason: 'Timing / not now' });

    // Meetings
    const agenda = (items) => items.map((a) => ({ id: U.uid('agi'), presenter: '', ...a }));
    const q3 = mk('meetings', {
      title: 'Q3 Regular Board Meeting', type: 'Regular', committee: '', date: at(-70, 17, 0), durationMin: 90, location: 'HQ conference room + Zoom', status: 'Minutes approved',
      agenda: agenda(Store.STANDARD_AGENDA.map((a, i) => ({ ...a, presenter: i === 2 ? me.name : i === 3 ? 'Priya Raman' : '' }))),
      attendance: { [dana.id]: 'present', [marcus.id]: 'present', [priya.id]: 'present', [robert.id]: 'excused', [elena.id]: 'present' },
      minutes: 'Quorum confirmed (3 of 4 voting directors present).\n\nCEO update: first client (Brightwater) live; 6 active opportunities.\nFinance: 14 months of runway at current burn.\nDiscussion on hiring a second business development rep; deferred to Q4.\n\nMotion to approve the FY operating plan passed unanimously.',
    }, -75);
    const special = mk('meetings', {
      title: 'Special Meeting: Line of Credit', type: 'Special', committee: '', date: at(-25, 8, 0), durationMin: 30, location: 'Zoom', status: 'Held',
      agenda: agenda([{ title: 'Call to order & quorum check', kind: 'Information', minutes: 5 }, { title: 'Approve $250k revolving line of credit', kind: 'Decision', minutes: 20, presenter: 'Priya Raman' }]),
      attendance: { [dana.id]: 'present', [marcus.id]: 'present', [priya.id]: 'present', [robert.id]: 'present', [elena.id]: 'absent' },
      minutes: 'All four voting directors present.\nTreasurer presented terms from two banks. Board approved the line of credit with Lone Star Bank.',
    }, -30);
    const audit = mk('meetings', {
      title: 'Audit & Finance Committee', type: 'Committee', committee: 'Audit & Finance', date: at(5, 16, 0), durationMin: 45, location: 'Zoom', status: 'Scheduled',
      agenda: agenda([{ title: 'Review draft 2027 budget', kind: 'Discussion', minutes: 30, presenter: 'Priya Raman' }, { title: 'Auditor engagement update', kind: 'Information', minutes: 15 }]),
      attendance: {}, minutes: '',
    }, -10);
    const q4 = mk('meetings', {
      title: 'Q4 Regular Board Meeting', type: 'Regular', committee: '', date: at(12, 17, 0), durationMin: 90, location: 'HQ conference room + Zoom', status: 'Scheduled',
      agenda: agenda(Store.STANDARD_AGENDA.map((a, i) => ({ ...a, presenter: i === 2 ? me.name : i === 3 ? 'Priya Raman' : i === 5 ? 'Dana Whitfield' : '' }))),
      attendance: {}, minutes: '',
    }, -8);

    // Resolutions
    const res = (number, title, meetingId, method, date, status, votes, description = '') => mk('resolutions', {
      number, title, description, meetingId, method, date, status, votesFor: votes[0], votesAgainst: votes[1], abstain: votes[2],
    }, -70);
    const y = (n) => day(n).slice(0, 4);
    res(`R-${y(-70)}-001`, 'Approve FY operating plan', q3.id, 'Meeting vote', day(-70), 'Approved', [3, 0, 0]);
    res(`R-${y(-70)}-002`, 'Approve minutes of previous meeting', q3.id, 'Meeting vote', day(-70), 'Approved', [3, 0, 0]);
    res(`R-${y(-25)}-003`, 'Approve $250k revolving line of credit with Lone Star Bank', special.id, 'Meeting vote', day(-25), 'Approved', [4, 0, 0], 'CEO and Treasurer authorized to sign.');
    res(`R-${y(-10)}-004`, 'Engage external auditor for FY review', '', 'Written consent', day(-10), 'Approved', [4, 0, 0], 'Unanimous written consent in lieu of a meeting.');
    res(`R-${y(12)}-005`, 'Approve 2027 operating budget', q4.id, 'Meeting vote', day(12), 'Proposed', [0, 0, 0]);

    // Activities (interactions with clients AND with the board)
    const act = (n, hh, type, subject, contactIds, orgId, notes, ownerId = me.id, extra = {}) => mk('activities', {
      type, date: at(n, hh), subject, contactIds, orgId, dealId: '', meetingId: '', notes, ownerId, ...extra,
    }, n);
    act(-58, 11, 'Meeting', 'Discovery meeting at Brightwater', [maria.id, samuel.id], bright.id, 'Pain point: patients lost between specialist referrals. Budget approved for a pilot.');
    act(-46, 15, 'Call', 'Contract signed', [samuel.id], bright.id, 'Signed annual agreement. Kickoff in 2 weeks.');
    act(-33, 10, 'Video call', 'Onboarding check-in', [maria.id], bright.id, 'Staff training done. 120 patients enrolled.', taylor.id);
    act(-6, 9, 'Email', 'Sent proposal for second location', [maria.id], bright.id, 'Proposal v1 sent; Maria will review with Dr. Okafor.');
    act(-40, 14, 'Meeting', 'Met Rachel at TX HR Summit', [rachel.id], north.id, 'Interested in a wellness program for 600 employees.', jordan.id);
    act(-19, 13, 'Video call', 'Program walkthrough with HR + Finance', [rachel.id, tom.id], north.id, 'Tom concerned about year-one cost. Offered phased rollout.', jordan.id);
    act(-4, 16, 'Call', 'Pricing negotiation', [tom.id], north.id, 'Asked for 10% discount for a 2-year term. Need to answer by Friday.', jordan.id);
    act(-25, 12, 'Message', 'LinkedIn intro', [olivia.id], summit.id, 'Connected via LinkedIn; booked discovery call.');
    act(-12, 11, 'Meeting', 'Discovery call with Summit PT', [olivia.id], summit.id, 'Wants remote follow-up for post-surgery patients. Send case study.');
    act(-3, 10, 'Call', 'Intro call with Harborview', [daniel.id], harbor.id, 'Inbound from website. 140 residents. Pilot interest.', jordan.id);
    act(-18, 10, 'Email', 'Cold email: wellness screening', [aisha.id], mesa.id, 'Opened twice, no reply yet.', jordan.id);
    act(-28, 15, 'Meeting', 'Partnership lunch with CareBridge', [grace.id], carebridge.id, 'Drafting a co-referral agreement.', taylor.id);
    act(-64, 9, 'Call', 'Quarterly catch-up with Victor', [victor.id], lumen.id, 'Referred Brightwater originally. Wants an update deck.');
    act(-35, 9, 'Email', 'Monthly investor update (September)', [hannah.id, robert.id], pinecrest.id, 'Shared metrics, pipeline and hiring plan.');
    // Board interactions
    act(-70, 17, 'Meeting', 'Q3 Regular Board Meeting', [dana.id, marcus.id, priya.id, elena.id], '', 'See meeting record for minutes and resolutions.', me.id, { meetingId: q3.id });
    act(-27, 12, 'Call', 'Pre-meeting call with the Chair', [dana.id], '', 'Aligned on the line of credit proposal before the special meeting.');
    act(-25, 8, 'Video call', 'Special Meeting: Line of Credit', [dana.id, marcus.id, priya.id, robert.id], '', 'Line of credit approved 4–0.', me.id, { meetingId: special.id });
    act(-14, 15, 'Meeting', '1:1 with Treasurer on 2027 budget', [priya.id], '', 'Priya will circulate the first draft to the Audit & Finance Committee.');
    act(-41, 11, 'Video call', 'Clinical protocol review', [elena.id], '', 'Elena reviewed remote monitoring protocol; suggested two changes.', taylor.id);

    // Tasks (follow-ups + board action items)
    const task = (title, due, ownerId, kind, links = {}, extra = {}) => mk('tasks', {
      title, due, ownerId, kind, priority: 'Normal', status: 'open', doneAt: '', contactId: '', orgId: '', dealId: '', meetingId: '', notes: '', ...links, ...extra,
    }, -5);
    task('Answer Tom on 2-year pricing', day(-1), jordan.id, 'Follow-up', { contactId: tom.id, orgId: north.id }, { priority: 'High' });
    task('Send Summit PT the post-surgery case study', day(0), me.id, 'Follow-up', { contactId: olivia.id, orgId: summit.id });
    task('Follow up on second-location proposal', day(2), me.id, 'Follow-up', { contactId: maria.id, orgId: bright.id });
    task('Book site visit at Harborview', day(4), jordan.id, 'Follow-up', { contactId: daniel.id, orgId: harbor.id });
    task('Second touch: Mesa Freight', day(-3), jordan.id, 'Follow-up', { contactId: aisha.id, orgId: mesa.id }, { priority: 'Low' });
    task('Send update deck to Victor', day(6), me.id, 'Follow-up', { contactId: victor.id, orgId: lumen.id });
    task('Send October investor update', day(8), me.id, 'To-do', { orgId: pinecrest.id });
    task('Circulate Q4 board pack (pre-read) 5 days before meeting', day(7), me.id, 'Board action', { meetingId: q4.id }, { priority: 'High' });
    task('Circulate draft 2027 budget to committee', day(2), priya.id, 'Board action', { meetingId: q3.id, contactId: priya.id });
    task('Present hiring plan for second BD rep', day(12), me.id, 'Board action', { meetingId: q3.id });
    task('Introduce two employer prospects from network', day(-5), dana.id, 'Board action', { meetingId: q3.id, contactId: dana.id });
    task('Start nominating process: Treasurer term ends soon', day(20), dana.id, 'Board action', { contactId: priya.id });
    task('Update HIPAA & data-handling policy', day(-40), taylor.id, 'Board action', { meetingId: q3.id }, { status: 'done', doneAt: day(-38) });
    task('Sign line of credit documents', day(-20), me.id, 'Board action', { meetingId: special.id }, { status: 'done', doneAt: day(-21) });

    return d;
  }

  return { build };
})();
