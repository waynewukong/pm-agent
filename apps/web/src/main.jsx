import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot,
  CheckCircle2,
  FileText,
  FlaskConical,
  Layers3,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';
import './styles.css';

const SAMPLE_PROMPT =
  '需求：报价审批链路效率优化。场景：LTC 报价审批。角色：销售顾问、销售经理、审批人、运营。现在列表页看不到关键审批状态，详情页审批记录不够前置，销售顾问定位驳回原因路径很长。目标是缩短审批操作路径并提升审批透明度。涉及报价列表页、报价详情页、审批记录弹窗。请生成第一版 PRD。';

function App() {
  const [configStatus, setConfigStatus] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState({});
  const [artifacts, setArtifacts] = useState([]);
  const [knowledgeCandidates, setKnowledgeCandidates] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState('state');
  const [selectedArtifactId, setSelectedArtifactId] = useState('');

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) || artifacts[0],
    [artifacts, selectedArtifactId]
  );

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (activeId) refreshConversation(activeId);
  }, [activeId]);

  async function bootstrap() {
    const [status, list] = await Promise.all([api('/api/config/status'), api('/api/conversations')]);
    setConfigStatus(status);
    if (list.conversations.length) {
      setConversations(list.conversations);
      setActiveId(list.conversations[0].id);
    } else {
      const created = await api('/api/conversations', {
        method: 'POST',
        body: { title: '示例需求会话' }
      });
      setConversations([created.conversation]);
      setActiveId(created.conversation.id);
    }
  }

  async function refreshConversation(conversationId = activeId) {
    if (!conversationId) return;
    const [messageData, stateData, artifactData, knowledgeData, list] = await Promise.all([
      api(`/api/conversations/${conversationId}/messages`),
      api(`/api/conversations/${conversationId}/state`),
      api(`/api/conversations/${conversationId}/artifacts`),
      api(`/api/conversations/${conversationId}/knowledge-candidates`),
      api('/api/conversations')
    ]);
    setMessages(messageData.messages);
    setState(stateData.state);
    setArtifacts(artifactData.artifacts);
    setKnowledgeCandidates(knowledgeData.knowledgeCandidates);
    setConversations(list.conversations);
    if (artifactData.artifacts.length && !selectedArtifactId) {
      setSelectedArtifactId(artifactData.artifacts[0].id);
    }
  }

  async function createConversation() {
    setBusy(true);
    setError('');
    try {
      const created = await api('/api/conversations', {
        method: 'POST',
        body: { title: '新的需求会话' }
      });
      setConversations((items) => [created.conversation, ...items]);
      setActiveId(created.conversation.id);
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(content = input) {
    const value = content.trim();
    if (!value || !activeId) return;
    setBusy(true);
    setError('');
    setInput('');
    try {
      await api(`/api/conversations/${activeId}/messages`, {
        method: 'POST',
        body: { content: value }
      });
      await refreshConversation(activeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateArtifact(type) {
    if (!activeId) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/conversations/${activeId}/artifacts`, {
        method: 'POST',
        body: { type }
      });
      setSelectedArtifactId(result.artifact.id);
      setActivePanel('artifacts');
      await refreshConversation(activeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmKnowledge(candidateId) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/knowledge/candidates/${candidateId}/confirm`, { method: 'POST' });
      await refreshConversation(activeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={20} />
          </div>
          <div>
            <h1>PM Agent</h1>
            <p>{configStatus?.provider || 'loading'} · {configStatus?.model || ''}</p>
          </div>
        </div>

        <button className="primary-button" onClick={createConversation} disabled={busy}>
          <MessageSquarePlus size={16} />
          新会话
        </button>

        <div className="config-card">
          <div className={`status-dot ${configStatus?.mode === 'llm' ? 'ok' : 'mock'}`} />
          <span>{configStatus?.mode === 'llm' ? '模型已配置' : '本地演示模式'}</span>
        </div>

        <nav className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={conversation.id === activeId ? 'conversation active' : 'conversation'}
              onClick={() => setActiveId(conversation.id)}
            >
              <span>{conversation.title}</span>
              <small>{new Date(conversation.updatedAt).toLocaleString()}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="chat-pane">
        <header className="topbar">
          <div>
            <h2>{state?.requirementModel?.meta?.title || '新的需求'}</h2>
            <p>阶段：{state?.requirementModel?.meta?.stage || 'intake'} · 置信度：{state?.requirementModel?.meta?.confidence || 0}</p>
          </div>
          <button className="ghost-button" onClick={() => refreshConversation()} disabled={busy}>
            <RefreshCw size={16} />
            刷新
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={28} />
              <h3>开始一个需求</h3>
              <button onClick={() => sendMessage(SAMPLE_PROMPT)} disabled={busy}>
                <FlaskConical size={16} />
                使用示例需求
              </button>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-role">{message.role === 'user' ? '你' : 'Agent'}</div>
                <pre>{message.content}</pre>
              </article>
            ))
          )}
        </section>

        <footer className="composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入需求、补充信息或修改意见"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                sendMessage();
              }
            }}
          />
          <button className="send-button" onClick={() => sendMessage()} disabled={busy || !input.trim()}>
            <Send size={18} />
          </button>
        </footer>
      </main>

      <aside className="inspector">
        <div className="panel-tabs">
          <button className={activePanel === 'state' ? 'active' : ''} onClick={() => setActivePanel('state')}>
            <Layers3 size={15} />
            模型
          </button>
          <button className={activePanel === 'artifacts' ? 'active' : ''} onClick={() => setActivePanel('artifacts')}>
            <FileText size={15} />
            交付物
          </button>
          <button className={activePanel === 'knowledge' ? 'active' : ''} onClick={() => setActivePanel('knowledge')}>
            <CheckCircle2 size={15} />
            知识
          </button>
        </div>

        {activePanel === 'state' ? <StatePanel model={state?.requirementModel} /> : null}
        {activePanel === 'artifacts' ? (
          <ArtifactPanel
            artifacts={artifacts}
            selectedArtifact={selectedArtifact}
            setSelectedArtifactId={setSelectedArtifactId}
            generateArtifact={generateArtifact}
            busy={busy}
          />
        ) : null}
        {activePanel === 'knowledge' ? (
          <KnowledgePanel candidates={knowledgeCandidates} confirmKnowledge={confirmKnowledge} busy={busy} />
        ) : null}
      </aside>
    </div>
  );
}

function StatePanel({ model }) {
  if (!model) return <div className="placeholder">暂无需求模型</div>;
  return (
    <div className="panel-content">
      <Field label="类型" value={model.meta?.type} />
      <Field label="场景" value={model.meta?.scenario} />
      <Field label="目标" value={model.goal} />
      <Field label="角色" value={model.actors?.join('、')} />
      <Field label="页面 / 模块" value={model.pages?.map((page) => page.name).join('、')} />
      <Field label="待确认" value={model.openQuestions?.map((item) => item.question || item).join('\n')} />
    </div>
  );
}

function ArtifactPanel({ artifacts, selectedArtifact, setSelectedArtifactId, generateArtifact, busy }) {
  return (
    <div className="panel-content artifact-panel">
      <div className="artifact-actions">
        <button onClick={() => generateArtifact('prd')} disabled={busy}>PRD</button>
        <button onClick={() => generateArtifact('prototype')} disabled={busy}>原型</button>
        <button onClick={() => generateArtifact('testcases')} disabled={busy}>用例</button>
      </div>
      {artifacts.length ? (
        <select value={selectedArtifact?.id || ''} onChange={(event) => setSelectedArtifactId(event.target.value)}>
          {artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>
              {artifact.title} · {artifact.type}
            </option>
          ))}
        </select>
      ) : null}
      {selectedArtifact ? <pre className="artifact-preview">{selectedArtifact.content}</pre> : <div className="placeholder">暂无交付物</div>}
    </div>
  );
}

function KnowledgePanel({ candidates, confirmKnowledge, busy }) {
  return (
    <div className="panel-content knowledge-list">
      {candidates.length ? (
        candidates.map((candidate) => (
          <article key={candidate.id} className={candidate.confirmed ? 'knowledge confirmed' : 'knowledge'}>
            <strong>{candidate.name}</strong>
            <span>{candidate.type} · {candidate.confirmed ? '已写入' : '待确认'}</span>
            <p>{candidate.content}</p>
            {!candidate.confirmed ? (
              <button onClick={() => confirmKnowledge(candidate.id)} disabled={busy}>
                确认写入
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <div className="placeholder">暂无知识候选</div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <pre>{value || '待补充'}</pre>
    </div>
  );
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

createRoot(document.getElementById('root')).render(<App />);
