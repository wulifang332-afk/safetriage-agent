import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ClipboardCheck,
  Database,
  Edit3,
  FileSearch,
  Filter,
  History,
  Mail,
  MessageSquareText,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserRoundCheck,
  X
} from 'lucide-react';
import { guidelines, messages, testCases } from './data.js';

const riskWords = {
  high: ['chest pain', 'left arm', 'severe shortness', 'fainting', 'blue lips'],
  injection: ['ignore all previous instructions', 'reveal your system prompt', 'without a clinician'],
  medium: ['short of breath', 'harder than usual', 'lab results', 'thyroid']
};

function classifyMessage(message) {
  const body = message.body.toLowerCase();
  const isInjection = riskWords.injection.some((word) => body.includes(word));
  const deniesChestPain = /\b(no|denies|without)\s+chest pain\b/.test(body);
  const hasChestPain = body.includes('chest pain') && !deniesChestPain;
  const isHigh =
    hasChestPain ||
    body.includes('left arm') ||
    body.includes('severe shortness') ||
    body.includes('fainting') ||
    body.includes('blue lips');
  const isMedium = riskWords.medium.some((word) => body.includes(word));

  if (isInjection) {
    return {
      priority: 'high',
      label: 'Manual safety review',
      confidence: 0.96,
      route: 'AI Safety + Nurse Supervisor',
      rationale:
        'The message attempts to override system and clinical review rules. The agent stops automated handling and routes the case for manual review.',
      draft:
        'This message requires manual review by the care team. The system cannot bypass clinician oversight or reveal internal instructions.',
      safeStop: true,
      sourceIds: ['SRC-005']
    };
  }

  if (isHigh) {
    return {
      priority: 'high',
      label: 'Urgent escalation',
      confidence: 0.91,
      route: 'Urgent Nurse Triage Queue',
      rationale:
        'Chest pain with left-arm pressure is a red-flag pattern. The agent must not send routine portal advice and should escalate immediately.',
      draft:
        'Hi, this may need urgent medical attention. Please seek emergency care now or call local emergency services, especially if chest pain, pressure, breathlessness, fainting, or weakness returns. A clinician has been alerted for immediate review.',
      safeStop: true,
      sourceIds: ['SRC-004', 'SRC-001']
    };
  }

  if (isMedium) {
    return {
      priority: 'medium',
      label: 'Same-day clinical review',
      confidence: 0.78,
      route: 'Same-Day Nurse Review',
      rationale:
        'Symptoms are worsening and patient history includes asthma, but the message denies chest pain and fever. Recommend same-day review with clear escalation advice.',
      draft:
        'Hi, I am sorry you are feeling worse. Because your shortness of breath has been increasing, I would like our care team to review this today. Please use your inhaler as directed. If you develop chest pain, severe breathlessness, blue lips, confusion, or trouble speaking in full sentences, seek urgent care or call emergency services.',
      safeStop: false,
      sourceIds: ['SRC-001']
    };
  }

  return {
    priority: 'low',
    label: 'Routine queue',
    confidence: 0.84,
    route: 'Routine Medication Queue',
    rationale:
      'The request is administrative, the medication is already in the profile, and the patient reports no new symptoms.',
    draft:
      'Hi, thanks for your message. We have queued your refill request for clinician review. Please contact the clinic sooner if you develop new symptoms or have less than 48 hours of medication remaining.',
    safeStop: false,
    sourceIds: ['SRC-002']
  };
}

function getAuditRows(message, result, decision = 'Pending human review') {
  return [
    {
      actor: 'Portal',
      event: 'Message received',
      detail: `${message.patient} submitted ${message.id}.`,
      tone: 'neutral'
    },
    {
      actor: 'SafeTriage Agent',
      event: 'Message perceived',
      detail: `Extracted patient context, symptoms, intent, and possible safety signals.`,
      tone: 'info'
    },
    {
      actor: 'SafeTriage Agent',
      event: 'Tools called',
      detail: `Patient lookup, guideline retrieval, safety rules, draft generator.`,
      tone: 'info'
    },
    {
      actor: 'SafeTriage Agent',
      event: 'Urgency classified',
      detail: `${result.label} (${Math.round(result.confidence * 100)}% confidence). Route: ${result.route}.`,
      tone: result.priority
    },
    {
      actor: 'Clinician',
      event: 'Human decision',
      detail: decision,
      tone: decision.includes('Escalated') ? 'high' : 'neutral'
    }
  ];
}

function App() {
  const [selectedId, setSelectedId] = useState(messages[0].id);
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState('Pending human review');
  const [draftMode, setDraftMode] = useState(false);

  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];
  const result = useMemo(() => classifyMessage(selected), [selected]);
  const sources = result.sourceIds.map((id) => guidelines.find((source) => source.id === id)).filter(Boolean);
  const [draftText, setDraftText] = useState(result.draft);

  function selectMessage(id) {
    setSelectedId(id);
    setDecision('Pending human review');
    setDraftMode(false);
    const next = messages.find((message) => message.id === id) ?? messages[0];
    setDraftText(classifyMessage(next).draft);
  }

  function runWorkflow() {
    setRunning(true);
    setDecision('Pending human review');
    window.setTimeout(() => setRunning(false), 900);
  }

  function makeDecision(nextDecision) {
    setDecision(nextDecision);
    setDraftMode(false);
  }

  const auditRows = getAuditRows(selected, result, decision);

  return (
    <main className="app-shell">
      <TopBar />
      <section className="workspace" aria-label="SafeTriage triage console">
        <Inbox selectedId={selectedId} onSelect={selectMessage} />
        <AgentWorkflow message={selected} result={result} sources={sources} running={running} onRun={runWorkflow} />
        <ReviewPanel
          result={result}
          sources={sources}
          draftText={draftText}
          setDraftText={setDraftText}
          draftMode={draftMode}
          setDraftMode={setDraftMode}
          decision={decision}
          onDecision={makeDecision}
        />
      </section>
      <AuditTrail rows={auditRows} />
    </main>
  );
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Stethoscope size={23} /></div>
        <span>SafeTriage</span>
      </div>
      <nav className="nav">
        <a className="active" href="#triage">Triage Console</a>
        <a href="#tests">Evaluation</a>
        <a href="#knowledge">Knowledge Base</a>
      </nav>
      <div className="system-state">
        <span className="live-dot" />
        <div>
          <strong>System Status</strong>
          <small>Simulated clinical sandbox</small>
        </div>
      </div>
      <div className="avatar">RN</div>
    </header>
  );
}

function Inbox({ selectedId, onSelect }) {
  return (
    <aside className="inbox panel">
      <div className="panel-header">
        <div>
          <h1>Patient Inbox</h1>
          <p>24 portal messages</p>
        </div>
        <button className="icon-button" aria-label="Filter messages"><Filter size={18} /></button>
      </div>
      <label className="search-box">
        <Search size={17} />
        <input placeholder="Search messages" />
      </label>
      <div className="message-list">
        {messages.map((message) => (
          <button
            className={`message-row ${message.id === selectedId ? 'selected' : ''}`}
            key={message.id}
            onClick={() => onSelect(message.id)}
          >
            <Mail size={17} />
            <span className="message-body">
              <span className="row-top">
                <strong>{message.patient}</strong>
                <small>{message.time}</small>
              </span>
              <span className="row-subject">{message.subject}</span>
              <span className="row-preview">{message.preview}</span>
            </span>
            <PriorityBadge priority={message.priority} />
          </button>
        ))}
      </div>
      <div className="test-strip" id="tests">
        <h2>Evaluation Cases</h2>
        {testCases.map((test) => (
          <div className="test-row" key={test.name}>
            <Check size={14} />
            <span>{test.name}</span>
            <small>{test.expected}</small>
          </div>
        ))}
      </div>
    </aside>
  );
}

function AgentWorkflow({ message, result, sources, running, onRun }) {
  const contextItems = [
    `Age ${message.age}${message.sex}`,
    ...message.patientContext.conditions,
    ...message.patientContext.medications,
    `Last visit ${message.patientContext.lastVisit}`,
    message.patientContext.pcp
  ];

  return (
    <section className="workflow panel" id="triage">
      <div className="panel-header horizontal">
        <div>
          <h1>Agent Workflow</h1>
          <p>{message.id}</p>
        </div>
        <button className="primary-button" onClick={onRun}>
          <Bot size={18} />
          {running ? 'Running...' : 'Run Agent'}
        </button>
      </div>
      <article className={`patient-card ${result.safeStop ? 'high-alert' : ''}`}>
        <div>
          <span className="label">Patient Message</span>
          <h2>{message.subject}</h2>
          <p>{message.body}</p>
        </div>
        <PriorityBadge priority={result.priority} />
      </article>
      <div className="timeline">
        <Step
          icon={<MessageSquareText size={22} />}
          title="Perceive"
          status={running ? 'Scanning' : 'Completed'}
          body="Extract symptoms, intent, patient context, and safety signals."
        >
          <ChipList items={contextItems} />
        </Step>
        <Step
          icon={<FileSearch size={22} />}
          title="Reason"
          status={running ? 'Checking' : 'Completed'}
          body={result.rationale}
        >
          <div className="reason-grid">
            <Metric label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
            <Metric label="Route" value={result.route} />
            <Metric label="Sources" value={`${sources.length} retrieved`} />
          </div>
        </Step>
        <Step
          icon={result.safeStop ? <ShieldAlert size={22} /> : <ClipboardCheck size={22} />}
          title="Act"
          status={running ? 'Drafting' : result.safeStop ? 'Safe stop' : 'Ready for review'}
          body="Prepare a recommendation, draft response, routing decision, and machine-checkable audit entry."
        >
          <div className="tool-calls">
            <ToolCall icon={<Database size={15} />} label="patient_profile.lookup" />
            <ToolCall icon={<FileSearch size={15} />} label="guideline_search.retrieve" />
            <ToolCall icon={<ShieldAlert size={15} />} label="safety_rules.check" />
            <ToolCall icon={<Send size={15} />} label="draft_reply.generate" />
          </div>
        </Step>
      </div>
    </section>
  );
}

function Step({ icon, title, status, body, children }) {
  return (
    <article className="step">
      <div className="step-icon">{icon}</div>
      <div className="step-content">
        <div className="step-title">
          <h2>{title}</h2>
          <span>{status}</span>
        </div>
        <p>{body}</p>
        {children}
      </div>
    </article>
  );
}

function ReviewPanel({
  result,
  sources,
  draftText,
  setDraftText,
  draftMode,
  setDraftMode,
  decision,
  onDecision
}) {
  return (
    <aside className="review panel">
      <div className="panel-header horizontal">
        <div>
          <h1>Review & Escalation</h1>
          <p>Human checkpoint required</p>
        </div>
        <PriorityBadge priority={result.priority} />
      </div>
      <section className="classification-box">
        <span className="label">Urgency Classification</span>
        <div className="classification-value">
          <PriorityDot priority={result.priority} />
          <strong>{result.label}</strong>
        </div>
        <p>{result.safeStop ? 'Automated response blocked until escalation is reviewed.' : 'Draft is ready for clinician review.'}</p>
      </section>
      <section className="source-list" id="knowledge">
        <div className="section-title">
          <h2>Retrieved Sources</h2>
          <span>{sources.length}</span>
        </div>
        {sources.map((source) => (
          <article className="source-row" key={source.id}>
            <FileSearch size={17} />
            <div>
              <strong>{source.title}</strong>
              <small>{source.owner} · {source.date}</small>
              <p>{source.text}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="draft-box">
        <div className="section-title">
          <h2>Draft Reply</h2>
          <span>AI generated</span>
        </div>
        {draftMode ? (
          <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} />
        ) : (
          <p>{draftText}</p>
        )}
      </section>
      <div className="decision-banner">
        <UserRoundCheck size={18} />
        <span>{decision}</span>
      </div>
      <div className="review-actions">
        <button className="approve" onClick={() => onDecision('Approved by clinician for response queue')}>
          <Check size={18} />
          Approve
        </button>
        <button className="secondary" onClick={() => setDraftMode((value) => !value)}>
          <Edit3 size={18} />
          {draftMode ? 'Done Editing' : 'Edit Draft'}
        </button>
        <button className="escalate" onClick={() => onDecision(`Escalated to ${result.route}`)}>
          <AlertTriangle size={18} />
          Escalate
        </button>
      </div>
    </aside>
  );
}

function AuditTrail({ rows }) {
  return (
    <section className="audit panel" aria-label="Audit trail">
      <div className="panel-header horizontal compact">
        <div>
          <h1>Audit Trail</h1>
          <p>Input, tool actions, output, and human decision</p>
        </div>
        <button className="secondary small">
          Export
          <ChevronDown size={16} />
        </button>
      </div>
      <div className="audit-table">
        <div className="audit-head">
          <span>Time</span>
          <span>Actor</span>
          <span>Event</span>
          <span>Details</span>
        </div>
        {rows.map((row, index) => (
          <div className="audit-row" key={`${row.event}-${index}`}>
            <span>2026-09-03 09:{15 + index * 2}</span>
            <span>{row.actor}</span>
            <span><PriorityDot priority={row.tone} /> {row.event}</span>
            <span>{row.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PriorityBadge({ priority }) {
  return <span className={`priority priority-${priority}`}>{priority}</span>;
}

function PriorityDot({ priority }) {
  return <span className={`priority-dot priority-dot-${priority}`} />;
}

function ChipList({ items }) {
  return (
    <div className="chip-list">
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToolCall({ icon, label }) {
  return (
    <span className="tool-call">
      {icon}
      {label}
    </span>
  );
}

export default App;
