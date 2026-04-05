const STAGES = [
  {
    key: 'planner',
    label: '规划',
    caption: '分析问题并确定回答策略',
    icon: 'fa-solid fa-compass-drafting'
  },
  {
    key: 'retrieval',
    label: '检索',
    caption: '从知识库中提取相关证据',
    icon: 'fa-solid fa-magnifying-glass'
  },
  {
    key: 'research',
    label: '研究',
    caption: '整理线索并形成研究摘要',
    icon: 'fa-solid fa-microscope'
  },
  {
    key: 'response',
    label: '生成',
    caption: '合成最终回答并附带引用',
    icon: 'fa-solid fa-sparkles'
  }
];

const STAGE_ALIAS = {
  planner: 'planner',
  retrieval: 'retrieval',
  research: 'research',
  response: 'response',
  responder: 'response',
  'knowledge-search': 'retrieval'
};

const DEFAULT_RUNTIME_STATUS = {
  code: 'degraded',
  label: '降级模式',
  message: '正在检查运行状态...'
};

const state = {
  conversationId: createConversationId(),
  loading: false,
  catalog: {
    rootLabel: '默认知识库',
    documentCount: 0,
    nodes: [],
    runtimeStatus: DEFAULT_RUNTIME_STATUS
  },
  runtimeStatus: DEFAULT_RUNTIME_STATUS,
  sources: [],
  trace: [],
  filter: '',
  selectedDoc: null,
  activeSourceIndex: null,
  viewportMode: '',
  detailView: 'sources',
  treeExpanded: new Set(),
  lastQuestion: '',
  promptCollapsed: false,
  collapsed: {
    left: false,
    evidence: false,
    audit: true
  },
  theme: loadStoredValue('console-theme', 'light'),
  focusMode: loadStoredValue('console-focus-mode', 'false') === 'true',
  stages: createStageStateMap()
};

const elements = {
  appShell: document.getElementById('appShell'),
  runtimeBanner: document.getElementById('runtimeBanner'),
  runtimeStatusLabel: document.getElementById('runtimeStatusLabel'),
  runtimeStatusMessage: document.getElementById('runtimeStatusMessage'),
  conversationBadge: document.getElementById('conversationBadge'),
  currentStageLabel: document.getElementById('currentStageLabel'),
  requestStatusBadge: document.getElementById('requestStatusBadge'),
  themeToggle: document.getElementById('themeToggle'),
  focusToggle: document.getElementById('focusToggle'),
  focusNotice: document.getElementById('focusNotice'),
  focusNoticeExit: document.getElementById('focusNoticeExit'),
  stageStrip: document.getElementById('stageStrip'),
  catalogTree: document.getElementById('catalogTree'),
  documentCount: document.getElementById('documentCount'),
  treeRootLabel: document.getElementById('treeRootLabel'),
  treeRootMeta: document.getElementById('treeRootMeta'),
  treeRootChip: document.getElementById('treeRootChip'),
  docFilterInput: document.getElementById('docFilterInput'),
  chatLog: document.getElementById('chatLog'),
  sourceList: document.getElementById('sourceList'),
  traceList: document.getElementById('traceList'),
  form: document.getElementById('composerForm'),
  questionInput: document.getElementById('questionInput'),
  submitButton: document.getElementById('submitButton'),
  promptGrid: document.getElementById('promptGrid'),
  promptToggle: document.getElementById('promptToggle'),
  composerContext: document.getElementById('composerContext'),
  selectedDocLabel: document.getElementById('selectedDocLabel'),
  selectedDocPath: document.getElementById('selectedDocPath'),
  clearDocContext: document.getElementById('clearDocContext'),
  leftPanelShell: document.getElementById('leftPanelShell'),
  evidencePanelShell: document.getElementById('evidencePanelShell'),
  auditPanelShell: document.getElementById('auditPanelShell'),
  toggleLeftPanel: document.getElementById('toggleLeftPanel'),
  toggleEvidencePanel: document.getElementById('toggleEvidencePanel'),
  toggleAuditPanel: document.getElementById('toggleAuditPanel'),
  detailTabs: document.getElementById('detailTabs'),
  detailTabSources: document.getElementById('detailTabSources'),
  detailTabTrace: document.getElementById('detailTabTrace')
};

initialize();

function initialize() {
  elements.conversationBadge.textContent = state.conversationId;
  bindEvents();
  applyTheme();
  applyFocusMode();
  syncViewportMode(true);
  renderRuntimeStatus();
  renderStageStrip();
  renderComposerContext();
  renderPromptToggle();
  renderDetailTabs();
  hydrateCatalog();
}

function bindEvents() {
  elements.docFilterInput.addEventListener('input', (event) => {
    state.filter = event.target.value.trim();
    renderCatalogTree();
  });

  elements.toggleLeftPanel.addEventListener('click', () => togglePanel('left'));
  elements.toggleEvidencePanel.addEventListener('click', () => togglePanel('evidence'));
  elements.toggleAuditPanel.addEventListener('click', () => togglePanel('audit'));

  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    persistValue('console-theme', state.theme);
    applyTheme();
  });

  elements.focusToggle.addEventListener('click', () => {
    state.focusMode = !state.focusMode;
    persistValue('console-focus-mode', String(state.focusMode));
    applyFocusMode();
  });

  elements.focusNoticeExit.addEventListener('click', () => {
    state.focusMode = false;
    persistValue('console-focus-mode', 'false');
    applyFocusMode();
  });

  elements.detailTabSources.addEventListener('click', () => setDetailView('sources'));
  elements.detailTabTrace.addEventListener('click', () => setDetailView('trace'));

  elements.clearDocContext.addEventListener('click', () => {
    state.selectedDoc = null;
    renderCatalogTree();
    renderComposerContext();
    elements.questionInput.focus();
  });

  elements.promptGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-question]');
    if (!target) {
      return;
    }
    elements.questionInput.value = target.dataset.question;
    elements.questionInput.focus();
  });

  elements.promptToggle.addEventListener('click', () => {
    state.promptCollapsed = !state.promptCollapsed;
    renderPromptToggle();
  });

  elements.form.addEventListener('submit', handleSubmit);
  window.addEventListener('resize', debounce(syncViewportMode, 120));
}

async function handleSubmit(event) {
  event.preventDefault();
  const question = elements.questionInput.value.trim();
  if (!question || state.loading) {
    return;
  }

  state.lastQuestion = question;
  appendMessage('user', question, { context: state.selectedDoc });
  elements.questionInput.value = '';
  startStreamingState();
  const loadingNode = appendMessage('assistant', '', { loading: true });

  try {
    const response = await fetch('/api/assistant/ask/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        question: buildEffectiveQuestion(question),
        conversationId: state.conversationId
      })
    });

    if (!response.ok || !response.body) {
      throw new Error('流式请求未能建立，状态码：' + response.status);
    }

    await consumeAssistantStream(response.body, loadingNode);
  } catch (error) {
    finalizeStreamFailure(loadingNode, error);
  }
}

async function consumeAssistantStream(stream, loadingNode) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      if (!block.trim()) {
        continue;
      }
      const event = parseSseBlock(block);
      if (!event) {
        continue;
      }
      const shouldStop = handleStreamEvent(event, loadingNode);
      if (shouldStop) {
        doneReceived = true;
      }
    }
  }

  if (!doneReceived) {
    throw new Error('流式响应意外结束，未收到完成事件。');
  }
}

function handleStreamEvent(event, loadingNode) {
  switch (event.event) {
    case 'session':
      state.conversationId = event.data.conversationId || state.conversationId;
      elements.conversationBadge.textContent = state.conversationId;
      applyRuntimeStatus(event.data.runtimeStatus);
      elements.requestStatusBadge.textContent = '链路已建立';
      return false;
    case 'stage':
      updateStageFromEvent(event.data, loadingNode);
      return false;
    case 'done':
      applyRuntimeStatus(event.data.runtimeStatus);
      finalizeStreamSuccess(loadingNode, event.data.response);
      return true;
    case 'error':
      applyRuntimeStatus(event.data.runtimeStatus);
      throw new Error(event.data.message || '请求执行失败。');
    default:
      return false;
  }
}

function updateStageFromEvent(payload, loadingNode) {
  const stageKey = normalizeStageKey(payload.stageKey);
  if (!stageKey) {
    return;
  }

  const stageLabel = payload.stageLabel || localizeStageLabel(stageKey);
  const message = payload.message || '处理中';
  const severity = payload.severity || 'normal';

  if (payload.status === 'started') {
    setStageActive(stageKey, stageLabel, message, severity);
  } else if (payload.status === 'completed') {
    setStageCompleted(stageKey, stageLabel, message, severity);
    state.trace = upsertTraceEntry(state.trace, {
      agentName: stageKey,
      summary: message || '已完成',
      latencyMs: extractLatencyMs(message),
      severity
    });
    renderTrace();
  }

  if (loadingNode) {
    updateLoadingMessage(loadingNode, `${stageLabel}：${message}`);
  }
}

function finalizeStreamSuccess(loadingNode, response) {
  state.loading = false;
  loadingNode?.remove();
  if (!response) {
    throw new Error('未收到最终回答。');
  }

  state.conversationId = response.conversationId || state.conversationId;
  elements.conversationBadge.textContent = state.conversationId;
  state.sources = response.sources || [];
  state.trace = (response.auditLog?.agentTrace || state.trace).map((step) => ({
    agentName: mapTraceName(step.agentName),
    summary: step.summary,
    latencyMs: step.latencyMs || 0,
    severity: step.severity || 'normal'
  }));
  state.activeSourceIndex = null;

  appendMessage('assistant', response.answer, {
    sources: state.sources,
    confidence: response.confidence,
    followUpQuestions: response.followUpQuestions,
    runtimeStatus: state.runtimeStatus,
    trace: state.trace
  });
  STAGES.forEach((stage) => {
    state.stages[stage.key] = {
      status: 'done',
      severity: state.stages[stage.key].severity,
      message: state.stages[stage.key].message
    };
  });
  elements.currentStageLabel.textContent = '已完成';
  elements.requestStatusBadge.textContent = '回答已生成';
  renderStageStrip();
  renderSources();
  renderTrace();
  renderDetailTabs();
  setComposerState(false);
}

function finalizeStreamFailure(loadingNode, error) {
  state.loading = false;
  loadingNode?.remove();
  appendMessage('assistant', '本次请求未能完成。', {
    errorType: 'system',
    errorMessage: error.message,
    retryQuestion: state.lastQuestion
  });
  elements.currentStageLabel.textContent = '执行失败';
  elements.requestStatusBadge.textContent = '请求失败';
  const activeStage = STAGES.find((stage) => state.stages[stage.key].status === 'active');
  if (activeStage) {
    state.stages[activeStage.key] = {
      status: 'error',
      severity: 'error',
      message: error.message
    };
  }
  state.trace = upsertTraceEntry(state.trace, {
    agentName: 'system',
    summary: error.message,
    latencyMs: 0,
    severity: 'error'
  });
  renderStageStrip();
  renderSources();
  renderTrace();
  renderDetailTabs();
  setComposerState(false);
}

async function hydrateCatalog() {
  try {
    const response = await fetch('/api/assistant/catalog');
    if (!response.ok) {
      throw new Error('知识库目录加载失败');
    }
    state.catalog = await response.json();
    applyRuntimeStatus(state.catalog.runtimeStatus);
    state.treeExpanded = new Set(collectFolderIds(state.catalog.nodes));
    renderCatalogTree();
  } catch (error) {
    state.catalog = {
      rootLabel: '默认知识库',
      documentCount: 0,
      nodes: [],
      runtimeStatus: {
        code: 'offline',
        label: '知识库离线',
        message: '知识库目录暂时不可用，请检查后端服务或稍后刷新重试。'
      }
    };
    applyRuntimeStatus(state.catalog.runtimeStatus);
    elements.catalogTree.innerHTML = '<div class="empty-state">知识库目录暂时不可用，请稍后刷新重试。</div>';
    elements.documentCount.textContent = '0 份文档';
    elements.treeRootMeta.textContent = '0 个节点';
    elements.treeRootChip.textContent = '加载失败';
  }
}

function renderCatalogTree() {
  const filteredNodes = filterTreeNodes(state.catalog.nodes, state.filter.toLowerCase());
  elements.documentCount.textContent = `${countDocuments(filteredNodes)}/${state.catalog.documentCount} 份文档`;
  elements.treeRootLabel.textContent = state.catalog.rootLabel;
  elements.treeRootMeta.textContent = `${filteredNodes.length} 个一级节点`;
  elements.treeRootChip.textContent = `${state.catalog.documentCount} 份文档`;

  if (!filteredNodes.length) {
    elements.catalogTree.innerHTML = '<div class="empty-state">没有匹配的文档或目录，请尝试更换筛选关键词。</div>';
    return;
  }

  elements.catalogTree.innerHTML = filteredNodes.map((node) => renderTreeNode(node, 0)).join('');
  bindTreeEvents();
}

function renderTreeNode(node, depth) {
  if (node.type === 'DOCUMENT') {
    const activeClass = node.id === state.selectedDoc?.id ? ' is-active' : '';
    return `
      <div class="tree-node" style="--tree-depth:${depth};">
        <button type="button" class="doc-item-button${activeClass}" data-node-id="${escapeHtml(node.id)}" data-node-type="DOCUMENT">
          <div class="doc-title-row">
            <span class="doc-title"><i class="fa-regular fa-file-lines"></i>${escapeHtml(node.label)}</span>
            <span class="doc-meta">${escapeHtml(node.path)}</span>
          </div>
          <p class="doc-summary">${escapeHtml(node.summary || '无摘要')}</p>
        </button>
      </div>
    `;
  }

  const isOpen = state.filter ? true : state.treeExpanded.has(node.id);
  return `
    <div class="tree-node" style="--tree-depth:${depth};">
      <div class="tree-node-header">
        <button type="button" class="tree-node-toggle${isOpen ? ' is-folder-open' : ''}" data-node-id="${escapeHtml(node.id)}" data-node-type="FOLDER">
          <span class="tree-node-main">
            <i class="fa-regular ${isOpen ? 'fa-folder-open' : 'fa-folder'}"></i>
            <span>${escapeHtml(node.label)}</span>
          </span>
          <span class="tree-node-meta">${countDocuments(node.children || [])} 份文档</span>
        </button>
      </div>
      ${isOpen ? `<div class="tree-node-children">${(node.children || []).map((child) => renderTreeNode(child, depth + 1)).join('')}</div>` : ''}
    </div>
  `;
}

function bindTreeEvents() {
  elements.catalogTree.querySelectorAll('[data-node-type="FOLDER"]').forEach((button) => {
    button.addEventListener('click', () => {
      const nodeId = button.dataset.nodeId;
      if (state.treeExpanded.has(nodeId)) {
        state.treeExpanded.delete(nodeId);
      } else {
        state.treeExpanded.add(nodeId);
      }
      renderCatalogTree();
    });
  });

  elements.catalogTree.querySelectorAll('[data-node-type="DOCUMENT"]').forEach((button) => {
    button.addEventListener('click', () => {
      const documentNode = findDocumentNode(state.catalog.nodes, button.dataset.nodeId);
      if (!documentNode) {
        return;
      }
      state.selectedDoc = {
        id: documentNode.id,
        label: documentNode.label,
        path: documentNode.path
      };
      renderCatalogTree();
      renderComposerContext();
      elements.questionInput.focus();
    });
  });
}

function renderStageStrip() {
  if (state.viewportMode === 'desktop') {
    elements.stageStrip.innerHTML = STAGES.map((stage) => {
      const stageMeta = state.stages[stage.key];
      return `
        <article class="stage-card is-${stageMeta.status} tone-${stageMeta.severity}">
          <div class="stage-card-header">
            <span class="stage-icon"><i class="${stage.icon}"></i></span>
            <span class="stage-state">${stageStateLabel(stageMeta.status)}</span>
          </div>
          <div>
            <h3>${stage.label}</h3>
            <p class="stage-caption">${stageMeta.message || stage.caption}</p>
          </div>
        </article>
      `;
    }).join('');
    return;
  }

  const activeStage = resolveSpotlightStage();
  const stageMeta = state.stages[activeStage.key];
  elements.stageStrip.innerHTML = `
    <div class="stage-stepper">
      ${STAGES.map((stage) => {
        const current = state.stages[stage.key];
        return `
          <div class="stage-step${current.status === 'active' ? ' is-active' : ''}${current.status === 'done' ? ' is-done' : ''}${current.status === 'error' ? ' is-error' : ''}">
            <span class="stage-step-dot"></span>
            <span class="stage-step-label">${stage.label}</span>
          </div>
        `;
      }).join('')}
    </div>
    <article class="stage-spotlight is-${stageMeta.status} tone-${stageMeta.severity}">
      <div class="stage-spotlight-top">
        <span class="conversation-chip">当前阶段</span>
        <span class="stage-state">${stageStateLabel(stageMeta.status)}</span>
      </div>
      <h3>${activeStage.label}</h3>
      <p class="stage-caption">${stageMeta.message || activeStage.caption}</p>
    </article>
  `;
}

function renderSources(options = {}) {
  if (options.loading) {
    elements.sourceList.innerHTML = createSkeletonCards(3);
    return;
  }

  if (!state.sources.length) {
    elements.sourceList.innerHTML = '<div class="empty-state">当前回答没有附带可引用证据。可以继续追问，或切换到审计轨迹查看执行摘要。</div>';
    return;
  }

  elements.sourceList.innerHTML = state.sources.map((source, index) => {
    const highlighted = state.activeSourceIndex === index ? ' is-highlighted' : '';
    return `
      <article class="source-card${highlighted}" data-source-index="${index}">
        <div class="source-card-header">
          <div>
            <div class="source-meta">来源 ${index + 1} / ${escapeHtml(source.sourceId)}</div>
            <h3>${escapeHtml(source.title)}</h3>
          </div>
          <span class="source-index">${index + 1}</span>
        </div>
        <p>${escapeHtml(source.excerpt)}</p>
      </article>
    `;
  }).join('');
}

function renderTrace(options = {}) {
  if (options.loading) {
    elements.traceList.innerHTML = createSkeletonCards(4);
    return;
  }

  if (!state.trace.length) {
    elements.traceList.innerHTML = '<div class="empty-state">发起一次提问后，这里会显示执行摘要与降级提示。</div>';
    return;
  }

  elements.traceList.innerHTML = state.trace.map((step) => `
    <article class="trace-card is-${escapeHtml(step.severity || 'normal')}">
      <div class="trace-meta">${escapeHtml(localizeAgentName(step.agentName))} / ${Number(step.latencyMs || 0)} ms</div>
      <h3>${escapeHtml(step.summary)}</h3>
      <p>${escapeHtml(traceHint(step.severity))}</p>
    </article>
  `).join('');
}

function appendMessage(role, content, options = {}) {
  const row = document.createElement('article');
  row.className = `message-row ${role === 'user' ? 'is-user' : 'is-assistant'}`;

  const card = document.createElement('div');
  card.className = 'message-card';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `
    <span class="message-role">${role === 'user' ? '用户' : '助手'}</span>
    <span class="message-tag">${role === 'user' ? '提问' : options.loading ? '处理中' : options.errorType ? '异常' : '已回答'}</span>
  `;
  card.append(meta);

  if (options.context) {
    const contextNode = document.createElement('div');
    contextNode.className = 'message-context';
    contextNode.textContent = `参考文档：${options.context.label}`;
    card.append(contextNode);
  }

  if (options.loading) {
    const caption = document.createElement('p');
    caption.className = 'loading-caption';
    caption.textContent = '正在建立实时链路，请稍候...';

    const loadingStack = document.createElement('div');
    loadingStack.className = 'loading-stack';
    loadingStack.innerHTML = `
      <div class="loading-bar"></div>
      <div class="loading-bar"></div>
      <div class="loading-bar"></div>
    `;

    card.append(caption, loadingStack);
  } else {
    const notice = role === 'assistant' ? createMessageNotice(options) : null;
    if (notice) {
      card.append(notice);
    }

    if (role === 'assistant' && !options.errorType) {
      const summary = createAnswerSummary(options);
      if (summary) {
        card.append(summary);
      }
    }

    const body = document.createElement('p');
    body.className = 'message-body';
    body.textContent = content;
    card.append(body);

    if (role === 'assistant' && options.sources?.length) {
      const footer = document.createElement('div');
      footer.className = 'message-footer';

      const helper = document.createElement('span');
      helper.className = 'helper-inline';
      helper.textContent = '引用证据';
      footer.append(helper);

      options.sources.forEach((source, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `citation-chip${state.activeSourceIndex === index ? ' is-active' : ''}`;
        button.textContent = `[${index + 1}] ${shortTitle(source.title, 8)}`;
        button.title = `${source.title} · 点击定位证据`;
        button.addEventListener('click', () => highlightSource(index, options.sources));
        footer.append(button);
      });
      card.append(footer);
    }

    if (role === 'assistant' && options.followUpQuestions?.length) {
      const followUpGroup = document.createElement('div');
      followUpGroup.className = 'follow-up-group';

      const helper = document.createElement('span');
      helper.className = 'helper-inline';
      helper.textContent = '继续追问';
      followUpGroup.append(helper);

      options.followUpQuestions.forEach((question) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'follow-up-chip';
        button.textContent = question;
        button.addEventListener('click', () => {
          elements.questionInput.value = question;
          elements.questionInput.focus();
        });
        followUpGroup.append(button);
      });
      card.append(followUpGroup);
    }

    if (options.errorType === 'system' && options.retryQuestion) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'inline-action';
      action.textContent = '重新填写刚才的问题';
      action.addEventListener('click', () => {
        elements.questionInput.value = options.retryQuestion;
        elements.questionInput.focus();
      });
      card.append(action);

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'inline-action';
      retry.textContent = '重试本次请求';
      retry.addEventListener('click', () => retryLastQuestion());
      card.append(retry);
    }
  }

  row.append(card);
  elements.chatLog.append(row);
  smoothScrollToLatest();
  return row;
}

function createMessageNotice(options) {
  const descriptor = describeMessageNotice(options);
  if (!descriptor) {
    return null;
  }
  const notice = document.createElement('div');
  notice.className = `status-note is-${descriptor.tone}`;
  notice.innerHTML = `
    <strong>${escapeHtml(descriptor.title)}</strong>
    <span>${escapeHtml(descriptor.body)}</span>
  `;
  return notice;
}

function createAnswerSummary(options) {
  const chips = [];
  if (options.confidence) {
    chips.push(`<span class="summary-chip confidence-${String(options.confidence).toLowerCase()}">${escapeHtml(localizeConfidence(options.confidence))}</span>`);
  }
  chips.push(`<span class="summary-chip ${options.sources?.length ? '' : 'is-warning'}">${options.sources?.length || 0} 条证据</span>`);
  if (hasDegradedSignal(options)) {
    chips.push('<span class="summary-chip is-degraded">降级链路</span>');
  } else if (!options.sources?.length) {
    chips.push('<span class="summary-chip is-warning">证据不足</span>');
  }
  if (!chips.length) {
    return null;
  }
  const summary = document.createElement('div');
  summary.className = 'answer-summary';
  summary.innerHTML = chips.join('');
  return summary;
}

function describeMessageNotice(options) {
  if (options.errorType === 'system') {
    return {
      tone: 'error',
      title: '系统失败',
      body: options.errorMessage || '请求未能完成，请检查后端服务或稍后重试。'
    };
  }
  if (!options.sources?.length) {
    return {
      tone: 'warning',
      title: '证据不足',
      body: '这次回答没有检索到可靠证据，建议缩小范围、指定文档或更换关键词再问。'
    };
  }
  if (hasDegradedSignal(options)) {
    return {
      tone: 'degraded',
      title: '已使用降级链路',
      body: '本次回答通过本地降级链路生成，建议结合证据内容复核。'
    };
  }
  return null;
}

function updateLoadingMessage(loadingNode, message) {
  const caption = loadingNode.querySelector('.loading-caption');
  if (caption) {
    caption.textContent = message;
  }
}

function highlightSource(index, sources = state.sources) {
  state.sources = sources;
  state.activeSourceIndex = index;
  setDetailView('sources');
  if (state.collapsed.evidence) {
    state.collapsed.evidence = false;
    renderPanelStates();
  }
  renderSources();

  const target = elements.sourceList.querySelector(`[data-source-index="${index}"]`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  elements.chatLog.querySelectorAll('.citation-chip').forEach((chip, chipIndex) => {
    chip.classList.toggle('is-active', chipIndex === index);
  });
}

function retryLastQuestion() {
  if (state.loading || !state.lastQuestion) {
    return;
  }
  elements.questionInput.value = state.lastQuestion;
  elements.questionInput.focus();
  elements.form.requestSubmit();
}

function startStreamingState() {
  state.loading = true;
  state.sources = [];
  state.trace = [];
  state.activeSourceIndex = null;
  state.stages = createStageStateMap();
  renderStageStrip();
  renderSources({ loading: true });
  renderTrace({ loading: true });
  elements.currentStageLabel.textContent = '建立链路';
  elements.requestStatusBadge.textContent = '处理中';
  setComposerState(true);
}

function setStageActive(stageKey, label, message, severity) {
  STAGES.forEach((stage) => {
    if (stage.key === stageKey) {
      state.stages[stage.key] = { status: 'active', severity, message };
    } else if (state.stages[stage.key].status !== 'done') {
      state.stages[stage.key] = {
        status: 'pending',
        severity: state.stages[stage.key].severity,
        message: state.stages[stage.key].message
      };
    }
  });
  elements.currentStageLabel.textContent = label;
  elements.requestStatusBadge.textContent = message;
  renderStageStrip();
}

function setStageCompleted(stageKey, label, message, severity) {
  state.stages[stageKey] = { status: 'done', severity, message };
  elements.currentStageLabel.textContent = label;
  elements.requestStatusBadge.textContent = message;
  renderStageStrip();
}

function setComposerState(disabled) {
  elements.submitButton.disabled = disabled;
  elements.questionInput.disabled = disabled;
}

function togglePanel(key) {
  state.collapsed[key] = !state.collapsed[key];
  renderPanelStates();
}

function renderPanelStates() {
  if (state.viewportMode !== 'desktop') {
    state.collapsed.evidence = false;
    state.collapsed.audit = false;
  }
  applyPanelState(elements.leftPanelShell, elements.toggleLeftPanel, state.collapsed.left, 'leftPanelBody');
  applyPanelState(elements.evidencePanelShell, elements.toggleEvidencePanel, state.collapsed.evidence, 'evidencePanelBody');
  applyPanelState(elements.auditPanelShell, elements.toggleAuditPanel, state.collapsed.audit, 'auditPanelBody');
  document.body.dataset.viewportMode = state.viewportMode;
  document.body.dataset.detailView = state.detailView;
}

function applyPanelState(shell, button, isCollapsed, controlsId) {
  shell.classList.toggle('is-collapsed', isCollapsed);
  button.setAttribute('aria-expanded', String(!isCollapsed));
  button.setAttribute('aria-controls', controlsId);
}

function syncViewportMode(force = false) {
  const width = window.innerWidth;
  const nextMode = width <= 860 ? 'mobile' : width <= 1260 ? 'tablet' : 'desktop';
  if (!force && nextMode === state.viewportMode) {
    return;
  }

  const previousMode = state.viewportMode;
  state.viewportMode = nextMode;
  if (!state.focusMode) {
    if (nextMode === 'desktop') {
      state.collapsed.left = false;
      state.collapsed.evidence = false;
      state.collapsed.audit = true;
    } else {
      state.collapsed.left = true;
      state.collapsed.evidence = false;
      state.collapsed.audit = false;
      state.detailView = 'sources';
    }
  }
  if (previousMode !== nextMode) {
    state.promptCollapsed = nextMode === 'mobile';
  }
  renderStageStrip();
  renderPromptToggle();
  renderDetailTabs();
  renderPanelStates();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const isDark = state.theme === 'dark';
  elements.themeToggle.classList.toggle('is-active', isDark);
  elements.themeToggle.setAttribute('aria-pressed', String(isDark));
  elements.themeToggle.innerHTML = isDark
    ? '<i class="fa-regular fa-sun"></i><span>浅色模式</span>'
    : '<i class="fa-regular fa-moon"></i><span>深色模式</span>';
}

function applyFocusMode() {
  document.body.classList.toggle('is-focus-mode', state.focusMode);
  elements.focusToggle.classList.toggle('is-active', state.focusMode);
  elements.focusToggle.setAttribute('aria-pressed', String(state.focusMode));
  elements.focusToggle.innerHTML = state.focusMode
    ? '<i class="fa-solid fa-compress"></i><span>退出专注</span>'
    : '<i class="fa-solid fa-expand"></i><span>专注对话</span>';
  elements.focusNotice.hidden = !state.focusMode;

  if (state.focusMode) {
    state.collapsed.left = true;
    state.collapsed.evidence = true;
    state.collapsed.audit = true;
    renderPanelStates();
    renderDetailTabs();
    return;
  }

  syncViewportMode(true);
}

function smoothScrollToLatest() {
  elements.chatLog.scrollTo({ top: elements.chatLog.scrollHeight, behavior: 'smooth' });
}

function parseSseBlock(block) {
  const lines = block.split(/\n/);
  let eventName = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  try {
    return {
      event: eventName,
      data: JSON.parse(dataLines.join('\n'))
    };
  } catch (error) {
    return null;
  }
}

function filterTreeNodes(nodes, query) {
  if (!query) {
    return nodes;
  }
  return nodes.reduce((result, node) => {
    const nodeText = [node.label, node.summary, node.path].join(' ').toLowerCase();
    if (node.type === 'DOCUMENT') {
      if (nodeText.includes(query)) {
        result.push(node);
      }
      return result;
    }

    const children = filterTreeNodes(node.children || [], query);
    if (nodeText.includes(query) || children.length) {
      result.push({ ...node, children });
    }
    return result;
  }, []);
}

function findDocumentNode(nodes, targetId) {
  for (const node of nodes) {
    if (node.type === 'DOCUMENT' && node.id === targetId) {
      return node;
    }
    const found = findDocumentNode(node.children || [], targetId);
    if (found) {
      return found;
    }
  }
  return null;
}

function countDocuments(nodes) {
  return nodes.reduce((total, node) => {
    if (node.type === 'DOCUMENT') {
      return total + 1;
    }
    return total + countDocuments(node.children || []);
  }, 0);
}

function collectFolderIds(nodes) {
  const ids = [];
  for (const node of nodes) {
    if (node.type === 'FOLDER') {
      ids.push(node.id, ...collectFolderIds(node.children || []));
    }
  }
  return ids;
}

function createSkeletonCards(count) {
  return Array.from({ length: count }, () => `
    <article class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
    </article>
  `).join('');
}

function normalizeStageKey(stageKey) {
  return STAGE_ALIAS[stageKey] || null;
}

function createConversationId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'conv-' + Math.random().toString(16).slice(2, 10);
}

function createStageStateMap() {
  return Object.fromEntries(STAGES.map((stage) => [stage.key, {
    status: 'pending',
    severity: 'normal',
    message: stage.caption
  }]));
}

function stageStateLabel(stateValue) {
  return {
    pending: '待执行',
    active: '处理中',
    done: '已完成',
    error: '异常'
  }[stateValue] || '待执行';
}

function localizeStageLabel(stageKey) {
  return STAGES.find((stage) => stage.key === stageKey)?.label || stageKey;
}

function localizeAgentName(agentName) {
  return {
    planner: '规划代理',
    retrieval: '检索代理',
    research: '研究代理',
    response: '生成代理',
    responder: '回答代理',
    'knowledge-search': '知识检索',
    system: '系统'
  }[agentName] || agentName;
}

function localizeConfidence(confidence) {
  return {
    HIGH: '高可信',
    MEDIUM: '中可信',
    LOW: '低可信'
  }[confidence] || confidence;
}

function extractLatencyMs(message) {
  const match = /([0-9]+)ms/.exec(message || '');
  return match ? Number(match[1]) : 0;
}

function upsertTraceEntry(trace, entry) {
  const nextTrace = trace.filter((item) => item.agentName !== entry.agentName && item.agentName !== mapTraceName(entry.agentName));
  nextTrace.push({
    agentName: mapTraceName(entry.agentName),
    summary: entry.summary,
    latencyMs: entry.latencyMs || 0,
    severity: entry.severity || 'normal'
  });
  return nextTrace.sort((left, right) => stageOrder(left.agentName) - stageOrder(right.agentName));
}

function mapTraceName(agentName) {
  return agentName === 'response' ? 'responder' : agentName;
}

function stageOrder(agentName) {
  const order = ['planner', 'retrieval', 'research', 'responder', 'system'];
  const index = order.indexOf(agentName);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function resolveSpotlightStage() {
  return STAGES.find((stage) => state.stages[stage.key].status === 'active')
    || STAGES.find((stage) => state.stages[stage.key].status === 'error')
    || [...STAGES].reverse().find((stage) => state.stages[stage.key].status === 'done')
    || STAGES[0];
}

function traceHint(severity) {
  return {
    normal: '该阶段执行正常，可结合右侧证据继续核对。',
    degraded: '该阶段走了降级路径，建议结合证据手动确认。',
    error: '该阶段出现异常，请优先检查系统状态或重试。'
  }[severity || 'normal'] || '可结合右侧证据继续核对。';
}

function hasDegradedSignal(options) {
  return options.runtimeStatus?.code === 'degraded'
    || (options.trace || []).some((step) => step.severity === 'degraded');
}

function buildEffectiveQuestion(question) {
  if (!state.selectedDoc) {
    return question;
  }
  return `请优先参考知识文档《${state.selectedDoc.label}》（路径：${state.selectedDoc.path}）并回答：${question}`;
}

function shortTitle(title, maxLength) {
  if (!title || title.length <= maxLength) {
    return title || '';
  }
  return title.slice(0, maxLength) + '…';
}

function renderComposerContext() {
  const hasDoc = Boolean(state.selectedDoc);
  elements.composerContext.hidden = !hasDoc;
  if (!hasDoc) {
    return;
  }
  elements.selectedDocLabel.textContent = state.selectedDoc.label;
  elements.selectedDocPath.textContent = state.selectedDoc.path;
}

function renderPromptToggle() {
  const isMobile = state.viewportMode === 'mobile';
  elements.promptToggle.hidden = !isMobile;
  if (!isMobile) {
    elements.promptGrid.hidden = false;
    return;
  }
  elements.promptGrid.hidden = state.promptCollapsed;
  elements.promptToggle.textContent = state.promptCollapsed ? '展开示例问题' : '收起示例问题';
  elements.promptToggle.setAttribute('aria-expanded', String(!state.promptCollapsed));
}

function renderDetailTabs() {
  const tabbed = state.viewportMode !== 'desktop' && !state.focusMode;
  elements.detailTabs.hidden = !tabbed;
  elements.detailTabSources.classList.toggle('is-active', state.detailView === 'sources');
  elements.detailTabTrace.classList.toggle('is-active', state.detailView === 'trace');
  elements.detailTabSources.setAttribute('aria-selected', String(state.detailView === 'sources'));
  elements.detailTabTrace.setAttribute('aria-selected', String(state.detailView === 'trace'));
}

function setDetailView(view) {
  state.detailView = view;
  renderDetailTabs();
  renderPanelStates();
}

function renderRuntimeStatus() {
  elements.runtimeBanner.dataset.status = state.runtimeStatus.code;
  elements.runtimeStatusLabel.textContent = state.runtimeStatus.label;
  elements.runtimeStatusMessage.textContent = state.runtimeStatus.message;
}

function applyRuntimeStatus(runtimeStatus) {
  if (!runtimeStatus) {
    return;
  }
  state.runtimeStatus = runtimeStatus;
  renderRuntimeStatus();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadStoredValue(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function persistValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
  }
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
