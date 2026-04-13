-- ============================================================
-- EO CONTACT LOGGER — Supabase Schema
-- ============================================================
-- Run this in your Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. CAMPAIGNS
create table if not exists campaigns (
  id text primary key,
  name text not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Seed the default campaign
insert into campaigns (id, name, active)
values ('brs-2026', 'BRS Arrest (Apr 2026)', true)
on conflict (id) do nothing;

-- 2. CONTACTS
create table if not exists contacts (
  id text primary key,
  campaign text references campaigns(id),
  method text not null,
  caller_name text default '',
  caller_location text default '',
  identified boolean default true,
  source text not null,
  register text not null,
  tier text not null,
  key_phrases text default '',
  notes text default '',
  follow_up boolean default false,
  staff_initials text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for dashboard queries
create index if not exists idx_contacts_created on contacts(created_at desc);
create index if not exists idx_contacts_campaign on contacts(campaign);

-- 3. PLAYBOOK
create table if not exists playbook (
  id text primary key,
  section text not null, -- 'phoneScripts', 'emailTemplates', 'talkingPoints'
  title text not null,
  campaign text default '',
  tier text default '',
  subject text default '',
  content text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_playbook_section on playbook(section);

-- ============================================================
-- SEED DEFAULT PLAYBOOK
-- ============================================================

insert into playbook (id, section, title, campaign, tier, content, sort_order) values
('tier1-brs', 'phoneScripts', 'Tier 1 — BRS Standard Response (Acknowledge-Pivot-Close)', 'brs-2026', '1',
'ACKNOWLEDGE:
"Thank you for calling. [Sam / The Member] shares your deep respect for Ben Roberts-Smith''s service and for all veterans who have served Australia."

PIVOT:
"[Sam / The Member] believes that one of the freedoms our veterans fought for is the rule of law — and that includes the right of every Australian, especially a decorated soldier, to a fair trial and the presumption of innocence. Commenting publicly could actually undermine Mr Roberts-Smith''s defence."

CLOSE:
"I''ll make sure [Sam] knows you called and I''ve noted your concerns. Can I also help you with anything else today — a DVA matter or local service?"

IF PRESSED ON PAULINE HANSON:
"Senator Hanson is in the Senate and isn''t in government — she can say whatever she likes without consequence. [Sam] is accountable for what he says, and he takes that seriously because it affects real outcomes for this electorate."

DO NOT: Argue, educate, or extend the call beyond this framework.', 1),

('tier2-general', 'phoneScripts', 'Tier 2 — Disengagement Script (Any Campaign)', '', '2',
'WHEN TO USE: Caller is personally abusive to staff, refuses to let you speak, uses threatening language about the MP, or demands commitments you cannot make.

SCRIPT:
"I''ve noted your concerns and I''ll pass them to [Sam]. I''m not able to continue this call, but you''re welcome to put your views in writing to [office email address]."

THEN: End the call. You have the MP''s explicit permission to do this.

AFTER: Log the contact immediately. Take 15 minutes away from the phone. Brief your supervisor if available.

REMEMBER: You are not required to absorb abuse. Ending an abusive call is not a failure — it is the protocol.', 2),

('tier3-security', 'phoneScripts', 'Tier 3 — Security Protocol (Threat Made)', '', '3',
'WHEN TO USE: Caller makes a specific threat against the MP, staff, or the office. Someone arrives in person who is physically intimidating, refuses to leave, or is filming to provoke.

PHONE:
1. Say: "I need to end this call now." Hang up.
2. Do NOT engage further.
3. Document: caller details, time, exact words used.
4. Contact local police non-emergency line: [INSERT NUMBER]
5. Brief Chief of Staff / MP immediately.

WALK-IN:
1. Do NOT confront. Stay calm.
2. If safe, say: "I''m going to ask you to leave the office now."
3. If they refuse or you feel unsafe, move to the back office.
4. Call 000 if there is an immediate threat.
5. Call local police non-emergency if the person leaves.

FILMING WITHOUT CONSENT:
"I''m happy to help but I do not consent to being filmed. If you''d like to make a formal complaint, you can do so in writing."
If filming continues: step away from the counter. Do not engage with the camera.

AFTER: Log as Tier 3. Incident report to MP and CoS same day. Debrief with all staff present.', 3),

('tier1-general', 'phoneScripts', 'Tier 1 — General Pressure Campaign Response', '', '1',
'ACKNOWLEDGE:
"Thank you for getting in touch. [Sam] appreciates you raising this and I''ll make sure he''s aware of your views."

PIVOT (choose the appropriate line):
- If legal matter: "[Sam] believes it''s important that the legal process is allowed to run its course independently, which is a principle [he/the Coalition] has always supported."
- If policy matter: "[Sam] is actively engaged on this issue and has [raised it in Parliament / written to the Minister / taken it up with the relevant department]."
- If emotional/values-based: "[Sam] shares your concern about [the core value] and that''s reflected in [specific action taken]."

CLOSE:
"I''ve noted your details and your views. Is there anything else I can help you with today?"

DO NOT: Make promises the MP hasn''t authorised. Agree or disagree with the caller''s position. Argue.', 4)
on conflict (id) do nothing;

insert into playbook (id, section, title, campaign, subject, content, sort_order) values
('email-brs-constituent', 'emailTemplates', 'BRS — Civil Constituent (Within Electorate)', 'brs-2026', 'Re: Ben Roberts-Smith',
'Dear [Name],

Thank you for writing to me about the arrest of Ben Roberts-Smith VC MG. I appreciate you taking the time to share your views.

Like you, I have the deepest respect for Mr Roberts-Smith''s service to Australia and the courage he has demonstrated on behalf of our country. The Victoria Cross is the highest recognition our nation can bestow, and nothing diminishes that service.

As a matter of principle, I believe one of the freedoms our veterans fought to protect is the rule of law — including the presumption of innocence. Mr Roberts-Smith is entitled to a fair hearing, and I believe it would be wrong for any politician to prejudge the outcome of legal proceedings that are still before the courts. To do so could, in fact, undermine his defence.

I want to assure you that I remain deeply committed to supporting veterans and their families in [electorate]. [If applicable: I have recently [specific action — e.g. written to the Minister for Veterans'' Affairs regarding DVA processing times / supported funding for the local RSL / assisted X veterans with casework this year].]

If I can assist you with any matter relating to veterans'' services or any other issue, please don''t hesitate to contact my office.

Yours sincerely,
[Member''s name]
Member for [Electorate]', 1),

('email-brs-veteran', 'emailTemplates', 'BRS — Veteran (Personalised)', 'brs-2026', 'Re: Ben Roberts-Smith',
'Dear [Name / Rank + Name],

Thank you for your letter regarding Ben Roberts-Smith. I want you to know that as someone who has served, your perspective carries particular weight with me and I have read your message carefully.

I share your pride in the service of our ADF personnel and your concern that those who have served are treated with the respect they have earned. Mr Roberts-Smith''s Victoria Cross reflects extraordinary courage, and I hold that in the highest regard.

I also believe that the rule of law — the very principle that generations of Australian servicemen and women have fought to defend — requires that every person, including Mr Roberts-Smith, receives a fair trial and the presumption of innocence. It would be inappropriate for me to comment on matters that are before the courts, and I believe doing so could potentially harm his case rather than help it.

What I can do — and what I am focused on — is ensuring that veterans in [electorate] receive the support they deserve. [Personalise: reference specific local veterans'' work, DVA casework, RSL engagement, etc.]

If there is anything I can do to assist you personally — whether it relates to DVA, transition services, or any other matter — my office is here to help. Please call us on [number].

With respect for your service,
[Member''s name]
Member for [Electorate]', 2),

('email-outside-electorate', 'emailTemplates', 'Outside Electorate — Standard Redirect', '', 'Re: Your correspondence',
'Dear [Name],

Thank you for taking the time to write to me. I appreciate your concern about this issue.

As the Member for [Electorate], my primary responsibility is to represent the constituents of this electorate. I would encourage you to raise this matter with your own federal Member of Parliament, who is best placed to represent your views.

You can find your local Member at: www.aph.gov.au/Senators_and_Members/Members

Yours sincerely,
[Member''s name]
Member for [Electorate]', 3),

('email-general-legal', 'emailTemplates', 'General — Matter Before the Courts', '', 'Re: [Subject]',
'Dear [Name],

Thank you for writing to me about [subject]. I appreciate you sharing your views.

As this matter is currently the subject of legal proceedings, it would be inappropriate for me to comment publicly on the specifics of the case. I believe strongly in the independence of our legal system and the presumption of innocence — principles that are fundamental to our democracy.

I have noted your views and I appreciate you taking the time to contact my office.

If I can assist you with any other matter, please don''t hesitate to be in touch.

Yours sincerely,
[Member''s name]
Member for [Electorate]', 4)
on conflict (id) do nothing;

insert into playbook (id, section, title, campaign, content, sort_order) values
('tp-brs-core', 'talkingPoints', 'BRS — Core Talking Points', 'brs-2026',
'KEY MESSAGES:

1. RESPECT FOR SERVICE: "Ben Roberts-Smith''s service to this country, recognised by the Victoria Cross, deserves our deepest respect. Nothing changes that."

2. PRESUMPTION OF INNOCENCE: "Every Australian is entitled to the presumption of innocence and a fair trial. That includes — especially includes — a decorated veteran."

3. RULE OF LAW AS VETERAN VALUE: "The rule of law is one of the democratic principles our veterans fought to protect. Upholding it is not abandoning them — it''s honouring what they served for."

4. WHY SILENCE PROTECTS BRS: "If politicians start publicly declaring someone innocent before trial, we undermine the very process that could clear his name. BRS deserves better than being used as a political football."

5. ON HANSON COMPARISON: "Senator Hanson has the luxury of commentary without consequence. A Member of Parliament in government has to be responsible about what they say, because it has real-world effects on legal proceedings and on the outcomes I deliver for this electorate."

LINES TO AVOID:
- Do not comment on guilt or innocence
- Do not criticise the AFP or OSI directly
- Do not use the phrase "war crimes" — refer to "the charges" or "the legal proceedings"
- Do not engage with the $300 million figure — if pressed, say "that''s a question for the Attorney-General"
- Do not criticise Hanson by name — redirect to the distinction between commentary and responsibility', 1),

('tp-anzac-inoculation', 'talkingPoints', 'Anzac Day — Inoculation Lines', 'brs-2026',
'FOR USE IN ANZAC DAY MESSAGING AND EVENTS:

"We honour those who served, and we uphold the principle that every veteran deserves a fair hearing."

"Anzac Day is about the values our servicemen and women defended — including justice, the rule of law, and the fair go. Those values don''t stop applying when they''re difficult."

"My commitment to veterans isn''t measured in press conferences. It''s measured in the DVA cases we resolve, the services we fund, and the support we deliver every day of the year."

IF ASKED AT AN ANZAC EVENT ABOUT BRS:
"Today is about honouring all who served. I''m not going to turn a day of remembrance into a political discussion. I''m happy to discuss this at my office."

NOTE: Brief RSL event organisers before Anzac Day that this may come up. Have a pre-arranged exit strategy if confronted at a public event.', 2)
on conflict (id) do nothing;

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table campaigns;
alter publication supabase_realtime add table playbook;

-- ============================================================
-- DISABLE RLS (internal tool, no public access)
-- If you add auth later, replace these with proper policies
-- ============================================================
alter table contacts enable row level security;
alter table campaigns enable row level security;
alter table playbook enable row level security;

create policy "Allow all access to contacts" on contacts for all using (true) with check (true);
create policy "Allow all access to campaigns" on campaigns for all using (true) with check (true);
create policy "Allow all access to playbook" on playbook for all using (true) with check (true);
