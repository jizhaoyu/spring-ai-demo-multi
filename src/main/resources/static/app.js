const DEFAULT_LOCALE = 'zhCN';

const messages = { zhCN: {
  accessibility: {
    skipToMain: '跳到主内容'
  },
  controls: {
    themeLight: '浅色模式',
    themeDark: '深色模式',
    focusEnabled: '退出专注',
    focusDisabled: '专注对话',
    newConversation: '新建会话',
    send: '发送提问',
    jumpLatest: '回到最新消息'
  },
  composer: {
    placeholder: '请输入问题，例如：标准支持的响应时间是多少？'
  },
  shortcuts: {
    title: '高频问答快捷操作',
    close: '关闭',
    items: {
      help: '打开快捷键帮助面板',
      search: '聚焦文档搜索；手机端会先打开文档抽屉',
      composer: '回到问答输入区并聚焦输入框',
      evidence: '切换到证据面板',
      trace: '切换到轨迹面板',
      evidenceCopy: '复制当前高亮证据；默认附带来源信息'
    }
  },
  status: {
    idleStage: '待命',
    idleRequest: '待提问',
    connected: '链路已建立',
    completed: '已完成',
    answerReady: '回答已生成',
    failed: '执行失败',
    failedRequest: '请求失败',
    building: '建立链路',
    processing: '处理中'
  },
  stages: {
    planner: { label: '规划', caption: '分析问题并确定回答策略' },
    retrieval: { label: '检索', caption: '从知识库中提取相关证据' },
    research: { label: '研究', caption: '整理线索并形成研究摘要' },
    response: { label: '生成', caption: '合成最终回答并附带引用' }
  }
} };

function getMessage(path, fallback = '') {
  const value = path.split('.').reduce((current, key) => current?.[key], messages[DEFAULT_LOCALE]);
  return value ?? fallback;
}

function renderIconSprite(name, label = '', options = {}) {
  const className = options.className || 'icon';
  const decorative = options.decorative ?? true;
  const ariaAttributes = decorative
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapeHtml(label)}"`;
  return `<svg class="${className}" ${ariaAttributes} focusable="false"><use href="/icons.svg#${name}"></use></svg>`;
}

const STAGES = [
  {
    key: 'planner',
    label: getMessage('stages.planner.label', '规划'),
    caption: getMessage('stages.planner.caption', '分析问题并确定回答策略'),
    icon: 'compass'
  },
  {
    key: 'retrieval',
    label: getMessage('stages.retrieval.label', '检索'),
    caption: getMessage('stages.retrieval.caption', '从知识库中提取相关证据'),
    icon: 'magnifying-glass'
  },
  {
    key: 'research',
    label: getMessage('stages.research.label', '研究'),
    caption: getMessage('stages.research.caption', '整理线索并形成研究摘要'),
    icon: 'microscope'
  },
  {
    key: 'response',
    label: getMessage('stages.response.label', '生成'),
    caption: getMessage('stages.response.caption', '合成最终回答并附带引用'),
    icon: 'sparkles'
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

const DRAFT_STORAGE_KEY = 'console-question-draft';
const JOURNEY_STORAGE_KEY = 'console-journey-collapsed';
const RECENT_DOCS_STORAGE_KEY = 'console-recent-docs';
const PINNED_DOCS_STORAGE_KEY = 'console-pinned-docs';
const DOC_USAGE_STORAGE_KEY = 'console-doc-usage';

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
  recentDocs: [],
  pinnedDocs: [],
  commonDocs: [],
  docUsage: {},
  docDrawerOpen: false,
  responseMeta: {
    documentsScanned: 0,
    matchedDocuments: 0,
    degradedReason: '',
    confidenceReason: '',
    selectedStrategy: '',
    recoveryActions: []
  },
  lastQuestion: '',
  lastResponseConfidence: '',
  promptCollapsed: false,
  journeyCollapsed: loadStoredValue(JOURNEY_STORAGE_KEY, '') === ''
    ? window.innerWidth <= 860
    : loadStoredValue(JOURNEY_STORAGE_KEY, 'false') === 'true',
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
  askBar: document.getElementById('askBar'),
  askBarStatus: document.getElementById('askBarStatus'),
  contextualGuide: document.getElementById('contextualGuide'),
  exampleQuestionRail: document.getElementById('exampleQuestionRail'),
  newConversationButton: document.getElementById('newConversationButton'),
  conversationBadge: document.getElementById('conversationBadge'),
  conversationHelper: document.getElementById('conversationHelper'),
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
  worksetTabs: document.getElementById('worksetTabs'),
  recentDocsList: document.getElementById('recentDocsList'),
  pinnedDocsList: document.getElementById('pinnedDocsList'),
  commonDocsList: document.getElementById('commonDocsList'),
  docDrawer: document.getElementById('docDrawer'),
  docDrawerBackdrop: document.getElementById('docDrawerBackdrop'),
  docDrawerToggle: document.getElementById('docDrawerToggle'),
  docFilterInput: document.getElementById('docFilterInput'),
  shortcutHelpDialog: document.getElementById('shortcutHelpDialog'),
  shortcutHelpClose: document.getElementById('shortcutHelpClose'),
  messageActionMenu: document.getElementById('messageActionMenu'),
  evidenceCopyMenu: document.getElementById('evidenceCopyMenu'),
  skipToMain: document.getElementById('skipToMain'),
  validationWorkbench: document.getElementById('validationWorkbench'),
  validationSummary: document.getElementById('validationSummary'),
  citationDrawer: document.getElementById('citationDrawer'),
  validationTimeline: document.getElementById('validationTimeline'),
  chatLog: document.getElementById('chatLog'),
  sourceList: document.getElementById('sourceList'),
  traceList: document.getElementById('traceList'),
  form: document.getElementById('composerForm'),
  questionInput: document.getElementById('questionInput'),
  submitButton: document.getElementById('submitButton'),
  promptGrid: document.getElementById('promptGrid'),
  promptToggle: document.getElementById('promptToggle'),
  journeyPanel: document.getElementById('journeyPanel'),
  journeyToggle: document.getElementById('journeyToggle'),
  composerContext: document.getElementById('composerContext'),
  selectedDocLabel: document.getElementById('selectedDocLabel'),
  selectedDocPath: document.getElementById('selectedDocPath'),
  clearDocContext: document.getElementById('clearDocContext'),
  questionQualityLabel: document.getElementById('questionQualityLabel'),
  questionQualityHint: document.getElementById('questionQualityHint'),
  helperTextContent: document.getElementById('helperTextContent'),
  draftStatusBadge: document.getElementById('draftStatusBadge'),
  questionLengthBadge: document.getElementById('questionLengthBadge'),
  clearDraftButton: document.getElementById('clearDraftButton'),
  docSelectionState: document.getElementById('docSelectionState'),
  questionReadinessState: document.getElementById('questionReadinessState'),
  shortcutHintState: document.getElementById('shortcutHintState'),
  jumpLatestButton: document.getElementById('jumpLatestButton'),
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
  applyLocalizedStaticCopy();
  renderConversationBadge();
  hydrateDraft();
  hydrateWorksets();
  bindEvents();
  applyTheme();
  applyFocusMode();
  syncViewportMode(true);
  renderRuntimeStatus();
  renderWorksets();
  renderDocDrawer();
  renderStageStrip();
  renderComposerContext();
  renderJourneyPanel();
  renderPromptToggle();
  renderAskBar();
  renderContextualGuide();
  renderDetailTabs();
  renderSources();
  renderTrace();
  adjustQuestionInputHeight();
  syncQuestionExperience();
  updateJumpLatestButton();
  hydrateCatalog();
}

function applyLocalizedStaticCopy() {
  elements.skipToMain.textContent = getMessage('accessibility.skipToMain', '跳到主内容');
  elements.newConversationButton.querySelector('span').textContent = getMessage('controls.newConversation', '新建会话');
  elements.submitButton.querySelector('span').textContent = getMessage('controls.send', '发送提问');
  elements.jumpLatestButton.querySelector('span').textContent = getMessage('controls.jumpLatest', '回到最新消息');
  elements.questionInput.placeholder = getMessage('composer.placeholder', '请输入问题，例如：标准支持的响应时间是多少？');
  elements.shortcutHelpDialog.querySelector('.shortcut-help-header h2').textContent = getMessage('shortcuts.title', '高频问答快捷操作');
  elements.shortcutHelpClose.textContent = getMessage('shortcuts.close', '关闭');
  const shortcutParagraphs = elements.shortcutHelpDialog.querySelectorAll('.shortcut-item p');
  const shortcutKeys = ['help', 'search', 'composer', 'evidence', 'trace', 'evidenceCopy'];
  shortcutParagraphs.forEach((paragraph, index) => {
    paragraph.textContent = getMessage(`shortcuts.items.${shortcutKeys[index]}`, paragraph.textContent);
  });
}

function bindEvents() {
  elements.docFilterInput.addEventListener('input', (event) => {
    state.filter = event.target.value.trim();
    renderCatalogTree();
  });

  elements.toggleLeftPanel.addEventListener('click', () => togglePanel('left'));
  elements.toggleEvidencePanel.addEventListener('click', () => togglePanel('evidence'));
  elements.toggleAuditPanel.addEventListener('click', () => togglePanel('audit'));
  elements.newConversationButton.addEventListener('click', resetConversationState);
  elements.docDrawerToggle.addEventListener('click', () => toggleDocDrawer());
  elements.docDrawerBackdrop.addEventListener('click', () => toggleDocDrawer(false));
  document.addEventListener('keydown', handleGlobalShortcut);
  document.addEventListener('click', handleGlobalPointerDown, true);
  elements.shortcutHelpClose.addEventListener('click', closeShortcutHelp);

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
    renderWorksets();
    renderCatalogTree();
    renderComposerContext();
    syncQuestionExperience();
    elements.questionInput.focus();
  });

  elements.promptGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-question]');
    if (!target) {
      return;
    }
    elements.questionInput.value = target.dataset.question;
    handleQuestionInput();
    elements.questionInput.focus();
  });

  elements.promptToggle.addEventListener('click', () => {
    state.promptCollapsed = !state.promptCollapsed;
    renderPromptToggle();
  });

  elements.journeyToggle.addEventListener('click', () => {
    state.journeyCollapsed = !state.journeyCollapsed;
    persistValue(JOURNEY_STORAGE_KEY, String(state.journeyCollapsed));
    renderJourneyPanel();
  });

  elements.worksetTabs.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-workset-open]');
    if (openButton) {
      const documentNode = resolveDocumentReference(openButton.dataset.worksetOpen);
      if (documentNode) {
        selectDocument(documentNode);
      }
      return;
    }

    const pinButton = event.target.closest('[data-workset-pin]');
    if (pinButton) {
      togglePinnedDocument(pinButton.dataset.worksetPin);
    }
  });

  elements.clearDraftButton.addEventListener('click', clearDraft);
  elements.jumpLatestButton.addEventListener('click', smoothScrollToLatest);
  elements.questionInput.addEventListener('input', handleQuestionInput);
  elements.questionInput.addEventListener('keydown', handleQuestionKeydown);
  elements.chatLog.addEventListener('scroll', updateJumpLatestButton);
  elements.form.addEventListener('submit', handleSubmit);
  window.addEventListener('resize', debounce(() => {
    syncViewportMode();
    adjustQuestionInputHeight();
    updateJumpLatestButton();
  }, 120));
}

function hydrateDraft() {
  const draft = loadStoredValue(DRAFT_STORAGE_KEY, '');
  if (!draft) {
    return;
  }
  elements.questionInput.value = draft;
}

function hydrateWorksets() {
  state.recentDocs = readJsonValue(RECENT_DOCS_STORAGE_KEY, []);
  state.pinnedDocs = readJsonValue(PINNED_DOCS_STORAGE_KEY, []);
  state.docUsage = readJsonValue(DOC_USAGE_STORAGE_KEY, {});
  syncCommonDocs();
}

function renderConversationBadge() {
  elements.conversationBadge.textContent = formatConversationId(state.conversationId);
  elements.conversationBadge.title = state.conversationId;
  elements.conversationHelper.textContent = state.selectedDoc
    ? `当前已保留文档范围：${shortTitle(state.selectedDoc.label, 14)}`
    : '聊天太长时可新建会话，不影响已选文档范围。';
}

function formatConversationId(conversationId) {
  if (!conversationId) {
    return '初始化中';
  }
  return conversationId.length <= 18
    ? conversationId
    : `${conversationId.slice(0, 8)}…${conversationId.slice(-6)}`;
}

function handleQuestionInput() {
  persistValue(DRAFT_STORAGE_KEY, elements.questionInput.value);
  adjustQuestionInputHeight();
  syncQuestionExperience();
}

function handleQuestionKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!state.loading && elements.questionInput.value.trim()) {
      elements.form.requestSubmit();
    }
  }
}

function handleGlobalShortcut(event) {
  if (event.key === 'Escape') {
    closeShortcutHelp();
    closeActionMenus();
    if (state.docDrawerOpen) {
      toggleDocDrawer(false);
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    copyEvidenceAs('source');
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    focusDocumentSearch();
    return;
  }

  if (event.altKey && event.key === '1') {
    event.preventDefault();
    elements.questionInput.focus();
    elements.questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (event.altKey && event.key === '2') {
    event.preventDefault();
    focusDetailPanel('sources');
    return;
  }

  if (event.altKey && event.key === '3') {
    event.preventDefault();
    focusDetailPanel('trace');
    return;
  }

  if (event.key === '?' && !isEditableTarget(event.target)) {
    event.preventDefault();
    openShortcutHelp();
  }
}

function handleGlobalPointerDown(event) {
  if (elements.messageActionMenu.hidden && elements.evidenceCopyMenu.hidden) {
    return;
  }
  if (elements.messageActionMenu.contains(event.target) || elements.evidenceCopyMenu.contains(event.target)) {
    return;
  }
  if (event.target.closest('[data-message-menu-trigger]') || event.target.closest('[data-evidence-copy-trigger]')) {
    return;
  }
  closeActionMenus();
}

function isEditableTarget(target) {
  return Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
}

function openShortcutHelp() {
  if (typeof elements.shortcutHelpDialog.showModal === 'function' && !elements.shortcutHelpDialog.open) {
    elements.shortcutHelpDialog.showModal();
    elements.shortcutHelpClose.focus();
    return;
  }
  elements.shortcutHelpDialog.setAttribute('open', 'open');
  elements.shortcutHelpClose.focus();
}

function closeShortcutHelp() {
  if (typeof elements.shortcutHelpDialog.close === 'function' && elements.shortcutHelpDialog.open) {
    elements.shortcutHelpDialog.close();
    return;
  }
  elements.shortcutHelpDialog.removeAttribute('open');
}

function focusDocumentSearch() {
  if (state.viewportMode === 'desktop' && state.collapsed.left) {
    state.collapsed.left = false;
    renderPanelStates();
  }
  if (state.viewportMode === 'mobile') {
    toggleDocDrawer(true);
  }
  elements.docFilterInput.focus();
  elements.docFilterInput.select();
}

function focusDetailPanel(view) {
  setDetailView(view);
  const panel = view === 'sources' ? elements.evidencePanelShell : elements.auditPanelShell;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyRecoveryAction(actionLabel) {
  if (actionLabel.includes('文档')) {
    focusDocumentSearch();
    return;
  }
  if (actionLabel.includes('验证工作台') || actionLabel.includes('降级提示')) {
    elements.validationWorkbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (state.lastQuestion) {
    elements.questionInput.value = state.lastQuestion;
    handleQuestionInput();
  }
  elements.questionInput.focus();
}

function clearDraft() {
  elements.questionInput.value = '';
  persistValue(DRAFT_STORAGE_KEY, '');
  adjustQuestionInputHeight();
  syncQuestionExperience();
  elements.questionInput.focus();
}

function resetConversationState() {
  state.conversationId = createConversationId();
  state.lastQuestion = '';
  state.lastResponseConfidence = '';
  state.responseMeta = {
    documentsScanned: 0,
    matchedDocuments: 0,
    degradedReason: '',
    confidenceReason: '',
    selectedStrategy: '',
    recoveryActions: []
  };
  state.loading = false;
  state.sources = [];
  state.trace = [];
  state.activeSourceIndex = null;
  state.detailView = 'sources';
  state.stages = createStageStateMap();
  elements.questionInput.value = '';
  persistValue(DRAFT_STORAGE_KEY, '');
  adjustQuestionInputHeight();
  renderConversationBadge();
  renderWelcomeMessage();
  renderStageStrip();
  renderSources();
  renderTrace();
  renderPanelStates();
  renderDetailTabs();
  elements.currentStageLabel.textContent = getMessage('status.idleStage', '待命');
  elements.requestStatusBadge.textContent = getMessage('status.idleRequest', '待提问');
  setComposerState(false);
  elements.questionInput.focus();
}

function selectDocument(documentNode) {
  state.selectedDoc = {
    id: documentNode.id,
    label: documentNode.label,
    path: documentNode.path
  };
  rememberRecentDocument(state.selectedDoc);
  recordDocumentUsage(state.selectedDoc);
  renderWorksets();
  renderCatalogTree();
  renderComposerContext();
  syncQuestionExperience();
  if (state.viewportMode === 'mobile') {
    toggleDocDrawer(false);
  }
  elements.questionInput.focus();
}

function rememberRecentDocument(documentRef) {
  const nextRecentDocs = [documentRef, ...state.recentDocs.filter((item) => item.id !== documentRef.id)].slice(0, 6);
  state.recentDocs = nextRecentDocs;
  persistJsonValue(RECENT_DOCS_STORAGE_KEY, nextRecentDocs);
}

function recordDocumentUsage(documentRef) {
  const currentEntry = state.docUsage[documentRef.id] || { ...documentRef, count: 0 };
  state.docUsage[documentRef.id] = {
    id: documentRef.id,
    label: documentRef.label,
    path: documentRef.path,
    count: Number(currentEntry.count || 0) + 1
  };
  persistJsonValue(DOC_USAGE_STORAGE_KEY, state.docUsage);
  syncCommonDocs();
}

function syncCommonDocs() {
  state.commonDocs = Object.values(state.docUsage || {})
    .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
    .slice(0, 6)
    .map(({ count, ...documentRef }) => documentRef);
}

function togglePinnedDocument(documentId) {
  const existing = state.pinnedDocs.some((item) => item.id === documentId);
  if (existing) {
    state.pinnedDocs = state.pinnedDocs.filter((item) => item.id !== documentId);
  } else {
    const documentRef = resolveDocumentReference(documentId);
    if (!documentRef) {
      return;
    }
    state.pinnedDocs = [documentRef, ...state.pinnedDocs.filter((item) => item.id !== documentRef.id)].slice(0, 8);
  }
  persistJsonValue(PINNED_DOCS_STORAGE_KEY, state.pinnedDocs);
  renderWorksets();
}

function resolveDocumentReference(documentId) {
  return findDocumentNode(state.catalog.nodes, documentId)
    || state.recentDocs.find((item) => item.id === documentId)
    || state.pinnedDocs.find((item) => item.id === documentId)
    || state.commonDocs.find((item) => item.id === documentId)
    || null;
}

function syncQuestionExperience() {
  const question = elements.questionInput.value.trim();
  const descriptor = describeQuestionExperience(question);
  elements.questionQualityLabel.textContent = descriptor.title;
  elements.questionQualityHint.textContent = descriptor.hint;
  elements.helperTextContent.textContent = descriptor.helper;
  elements.draftStatusBadge.textContent = question ? '草稿已自动暂存' : '草稿为空';
  elements.draftStatusBadge.className = `assist-stat${question ? ' is-active' : ''}`;
  elements.questionLengthBadge.textContent = `${question.length} 字`;
  elements.questionLengthBadge.className = `assist-stat${descriptor.badgeTone ? ` ${descriptor.badgeTone}` : ''}`;
  elements.submitButton.disabled = state.loading || !question;
  elements.clearDraftButton.disabled = state.loading || !question;
  updateJourneyStatus(question, descriptor);
  renderAskBar(descriptor, question);
  renderContextualGuide(question, descriptor);
}

function describeQuestionExperience(question) {
  if (!question) {
    return {
      title: '先写问题，再补充范围',
      hint: '建议补充系统名、时间范围、环境或目标动作，系统会更容易命中证据。',
      helper: '回答会同时给出可信度、引用证据和可继续追问的建议。',
      ready: false,
      badgeTone: ''
    };
  }

  if (question.length < 10) {
    return {
      title: '问题还比较短',
      hint: '补充对象、场景或时间范围，系统更容易命中证据。',
      helper: '如果不确定怎么问，可以先点一个示例问题，再改成自己的业务语境。',
      ready: false,
      badgeTone: 'is-warning'
    };
  }

  if (!state.selectedDoc) {
    return {
      title: '问题已经可以发送',
      hint: '如果想减少歧义，可以先限定一份文档，或补充业务上下文。',
      helper: '按 Ctrl / ⌘ + Enter 可发送；回答会联动证据与执行轨迹。',
      ready: true,
      badgeTone: 'is-active'
    };
  }

  return {
    title: '问题上下文已较完整',
    hint: '已限定参考文档，发送后系统会优先引用所选资料。',
    helper: '按 Ctrl / ⌘ + Enter 可发送；系统会优先使用已选文档作答。',
    ready: true,
    badgeTone: 'is-ready'
  };
}

function updateJourneyStatus(question, descriptor) {
  const selectedDocLabel = state.selectedDoc ? `已限定：${shortTitle(state.selectedDoc.label, 12)}` : '未限定文档';
  elements.docSelectionState.textContent = selectedDocLabel;
  elements.docSelectionState.className = `journey-stat${state.selectedDoc ? ' is-active' : ''}`;
  renderConversationBadge();

  if (!question) {
    elements.questionReadinessState.textContent = '等待输入问题';
    elements.questionReadinessState.className = 'journey-stat';
    elements.shortcutHintState.textContent = '输入后可自动暂存草稿';
    elements.shortcutHintState.className = 'journey-stat is-active';
    return;
  }

  elements.questionReadinessState.textContent = descriptor.ready ? '问题可直接发送' : '建议再补充一点上下文';
  elements.questionReadinessState.className = `journey-stat${descriptor.ready ? ' is-ready' : ' is-warning'}`;
  elements.shortcutHintState.textContent = 'Ctrl / ⌘ + Enter 发送';
  elements.shortcutHintState.className = 'journey-stat is-active';
}

function adjustQuestionInputHeight() {
  elements.questionInput.style.height = 'auto';
  const nextHeight = Math.min(Math.max(elements.questionInput.scrollHeight, 132), 280);
  elements.questionInput.style.height = `${nextHeight}px`;
}

function updateJumpLatestButton() {
  const distanceFromBottom = elements.chatLog.scrollHeight - elements.chatLog.scrollTop - elements.chatLog.clientHeight;
  const hasOverflow = elements.chatLog.scrollHeight - elements.chatLog.clientHeight > 120;
  const messageCount = elements.chatLog.querySelectorAll('.message-row').length;
  elements.jumpLatestButton.hidden = !(messageCount > 2 && hasOverflow && distanceFromBottom > 80);
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
  persistValue(DRAFT_STORAGE_KEY, '');
  adjustQuestionInputHeight();
  syncQuestionExperience();
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
      renderConversationBadge();
      applyRuntimeStatus(event.data.runtimeStatus);
      elements.requestStatusBadge.textContent = getMessage('status.connected', '链路已建立');
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
  state.lastResponseConfidence = response.confidence || '';
  state.responseMeta = {
    documentsScanned: Number(response.documentsScanned || 0),
    matchedDocuments: Number(response.matchedDocuments || 0),
    degradedReason: response.degradedReason || '',
    confidenceReason: response.confidenceReason || '',
    selectedStrategy: response.selectedStrategy || '',
    recoveryActions: response.recoveryActions || []
  };
  renderConversationBadge();
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
    documentsScanned: response.documentsScanned,
    matchedDocuments: response.matchedDocuments,
    degradedReason: response.degradedReason,
    confidenceReason: response.confidenceReason,
    selectedStrategy: response.selectedStrategy,
    recoveryActions: response.recoveryActions,
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
  elements.currentStageLabel.textContent = getMessage('status.completed', '已完成');
  elements.requestStatusBadge.textContent = getMessage('status.answerReady', '回答已生成');
  renderStageStrip();
  renderSources();
  renderTrace();
  renderDetailTabs();
  setComposerState(false);
}

function finalizeStreamFailure(loadingNode, error) {
  state.loading = false;
  state.lastResponseConfidence = '';
  state.responseMeta = {
    documentsScanned: 0,
    matchedDocuments: 0,
    degradedReason: '',
    confidenceReason: '',
    selectedStrategy: '',
    recoveryActions: []
  };
  loadingNode?.remove();
  appendMessage('assistant', '本次请求未能完成。', {
    errorType: 'system',
    errorMessage: error.message,
    retryQuestion: state.lastQuestion
  });
  elements.currentStageLabel.textContent = getMessage('status.failed', '执行失败');
  elements.requestStatusBadge.textContent = getMessage('status.failedRequest', '请求失败');
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

function renderWorksets() {
  renderWorksetList(elements.recentDocsList, state.recentDocs, '选中过文档后，这里会保留最近使用记录。');
  renderWorksetList(elements.pinnedDocsList, state.pinnedDocs, '固定文档后，这里会出现常用资料快捷入口。');
  renderWorksetList(elements.commonDocsList, state.commonDocs, '开始选择文档后，这里会自动汇总最常用资料。');
}

function renderWorksetList(container, documents, emptyMessage) {
  if (!documents.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  container.innerHTML = documents.map((documentRef) => {
    const isActive = documentRef.id === state.selectedDoc?.id;
    const isPinned = state.pinnedDocs.some((item) => item.id === documentRef.id);
    return `
      <div class="workset-item">
        <button
          type="button"
          class="workset-chip${isActive ? ' is-active' : ''}"
          data-workset-open="${escapeHtml(documentRef.id)}"
          title="${escapeHtml(documentRef.path || documentRef.label)}"
        >
          <span>${escapeHtml(shortTitle(documentRef.label, 18))}</span>
          <span class="workset-chip-meta">${escapeHtml(shortTitle(documentRef.path || '', 24))}</span>
        </button>
        <button
          type="button"
          class="workset-pin${isPinned ? ' is-active' : ''}"
          data-workset-pin="${escapeHtml(documentRef.id)}"
          aria-pressed="${String(isPinned)}"
          title="${isPinned ? '取消固定文档' : '固定到工作集'}"
        >
          ${renderIconSprite('thumbtack')}
        </button>
      </div>
    `;
  }).join('');
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
            <span class="doc-title">${renderIconSprite('file-lines')}<span>${escapeHtml(node.label)}</span></span>
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
            ${renderIconSprite(isOpen ? 'folder-open' : 'folder')}
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
      selectDocument(documentNode);
    });
  });
}

function renderStageStrip() {
  if (state.viewportMode === 'desktop') {
    elements.stageStrip.innerHTML = STAGES.map((stage) => {
      const stageMeta = state.stages[stage.key];
      const fullMessage = stageMeta.message || stage.caption;
      return `
        <article class="stage-card is-${stageMeta.status} tone-${stageMeta.severity}">
          <div class="stage-card-header">
            <span class="stage-icon">${renderIconSprite(stage.icon)}</span>
            <span class="stage-state">${stageStateLabel(stageMeta.status)}</span>
          </div>
          <div>
            <h3>${stage.label}</h3>
            <p class="stage-caption" title="${escapeHtml(fullMessage)}">${escapeHtml(compactStageMessage(fullMessage, 78))}</p>
          </div>
        </article>
      `;
    }).join('');
    return;
  }

  const activeStage = resolveSpotlightStage();
  const stageMeta = state.stages[activeStage.key];
  const fullMessage = stageMeta.message || activeStage.caption;
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
      <p class="stage-caption" title="${escapeHtml(fullMessage)}">${escapeHtml(compactStageMessage(fullMessage, 92))}</p>
    </article>
  `;
}

function renderSources(options = {}) {
  if (options.loading) {
    elements.sourceList.innerHTML = createSkeletonCards(3);
    renderValidationWorkbench();
    return;
  }

  if (!state.sources.length) {
    elements.sourceList.innerHTML = createPanelEmptyState(
      state.lastQuestion
        ? {
            title: '这次回答还没有可引用证据',
            body: '可以缩小提问范围、指定文档，或直接继续追问让系统重新检索。',
            actions: [
              { action: 'retry', label: '重试本次请求' },
              { action: 'show-prompts', label: '查看示例问题' }
            ]
          }
        : {
            title: '证据会在提问后自动出现',
            body: '先输入一个问题，或点示例问题开始，系统会把命中的片段放到这里。',
            actions: [
              { action: 'focus-input', label: '直接提问' },
              { action: 'show-prompts', label: '查看示例问题' }
            ]
          }
    );
    bindEmptyStateActions(elements.sourceList);
    renderValidationWorkbench();
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
          <div class="source-card-actions">
            <button type="button" class="inline-action source-copy-trigger" data-evidence-copy-trigger="${index}">复制证据</button>
            <span class="source-index">${index + 1}</span>
          </div>
        </div>
        <p>${escapeHtml(source.excerpt)}</p>
      </article>
    `;
  }).join('');
  bindSourceActions();
  renderValidationWorkbench();
}

function renderTrace(options = {}) {
  if (options.loading) {
    elements.traceList.innerHTML = createSkeletonCards(4);
    renderValidationWorkbench();
    return;
  }

  if (!state.trace.length) {
    elements.traceList.innerHTML = createPanelEmptyState(
      state.lastQuestion
        ? {
            title: '这次请求没有留下可展示轨迹',
            body: '可以重试一次请求，或直接继续追问，系统会重新生成阶段摘要。',
            actions: [
              { action: 'retry', label: '重试本次请求' },
              { action: 'focus-input', label: '继续追问' }
            ]
          }
        : {
            title: '轨迹会在提问后自动展开',
            body: '发起问题后，这里会按阶段展示规划、检索、研究和生成摘要。',
            actions: [
              { action: 'focus-input', label: '开始提问' }
            ]
          }
    );
    bindEmptyStateActions(elements.traceList);
    renderValidationWorkbench();
    return;
  }

  elements.traceList.innerHTML = state.trace.map((step) => {
    const fullSummary = step.summary || '';
    return `
      <article class="trace-card is-${escapeHtml(step.severity || 'normal')}">
        <div class="trace-meta">${escapeHtml(localizeAgentName(step.agentName))} / ${Number(step.latencyMs || 0)} ms</div>
        <h3 title="${escapeHtml(fullSummary)}">${escapeHtml(compactStageMessage(fullSummary, 110))}</h3>
        <p>${escapeHtml(traceHint(step.severity))}</p>
      </article>
    `;
  }).join('');
  renderValidationWorkbench();
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
      const confidenceReason = renderConfidenceReason(options);
      if (confidenceReason) {
        card.append(confidenceReason);
      }
    }

    const body = document.createElement('p');
    body.className = 'message-body';
    body.textContent = content;
    card.append(body);

    const actions = role === 'assistant' ? createMessageActions(content, options) : null;
    if (actions) {
      card.append(actions);
    }

    const recoveryActions = role === 'assistant' ? renderRecoveryActions(options) : null;
    if (recoveryActions) {
      card.append(recoveryActions);
    }

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
        button.addEventListener('click', () => openCitationDrawer(index, options.sources));
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
          handleQuestionInput();
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
        handleQuestionInput();
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
  updateJumpLatestButton();
  return row;
}

function renderWelcomeMessage() {
  elements.chatLog.innerHTML = `
    <article class="message-row is-assistant">
      <div class="message-card">
        <div class="message-meta">
          <span class="message-role">助手</span>
          <span class="message-tag">系统引导</span>
        </div>
        <p class="message-body">欢迎使用中文知识库问答控制台。你可以先提问，也可以先选中左侧文档，再让系统优先参考它来回答。</p>
      </div>
    </article>
  `;
  updateJumpLatestButton();
}

function createPanelEmptyState(config) {
  const actions = (config.actions || []).map((action) => `
    <button type="button" class="inline-action empty-action" data-empty-action="${escapeHtml(action.action)}">
      ${escapeHtml(action.label)}
    </button>
  `).join('');

  return `
    <div class="empty-state rich-empty-state">
      <strong>${escapeHtml(config.title)}</strong>
      <p>${escapeHtml(config.body)}</p>
      ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
    </div>
  `;
}

function bindEmptyStateActions(container) {
  container.querySelectorAll('[data-empty-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.emptyAction;
      if (action === 'focus-input') {
        elements.questionInput.focus();
        return;
      }
      if (action === 'show-prompts') {
        if (state.viewportMode === 'mobile') {
          state.promptCollapsed = false;
          renderPromptToggle();
        }
        elements.promptGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (action === 'retry') {
        retryLastQuestion();
      }
    });
  });
}

function bindSourceActions() {
  elements.sourceList.querySelectorAll('.source-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-evidence-copy-trigger]')) {
        return;
      }
      openCitationDrawer(Number(card.dataset.sourceIndex));
    });
  });

  elements.sourceList.querySelectorAll('[data-evidence-copy-trigger]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openEvidenceCopyMenu(Number(button.dataset.evidenceCopyTrigger), button);
    });
  });
}

function createMessageActions(content, options) {
  if (options.loading || options.errorType) {
    return null;
  }

  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'inline-action';
  copyButton.textContent = '复制答案';
  copyButton.addEventListener('click', async () => {
    const copied = await copyTextToClipboard(content);
    flashActionLabel(copyButton, copied ? '已复制' : '复制失败');
  });
  actions.append(copyButton);

  if (options.sources?.length) {
    const sourceButton = document.createElement('button');
    sourceButton.type = 'button';
    sourceButton.className = 'inline-action';
    sourceButton.textContent = `查看 ${options.sources.length} 条证据`;
    sourceButton.addEventListener('click', () => openCitationDrawer(0, options.sources));
    actions.append(sourceButton);
  }

  if (options.trace?.length) {
    const traceButton = document.createElement('button');
    traceButton.type = 'button';
    traceButton.className = 'inline-action';
    traceButton.textContent = '查看执行轨迹';
    traceButton.addEventListener('click', () => {
      setDetailView('trace');
      if (state.collapsed.audit) {
        state.collapsed.audit = false;
        renderPanelStates();
      }
    });
    actions.append(traceButton);
  }

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'inline-action';
  menuButton.dataset.messageMenuTrigger = 'true';
  menuButton.textContent = '更多操作';
  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openMessageActionMenu(content, options, menuButton);
  });
  actions.append(menuButton);

  return actions;
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

function renderConfidenceReason(options) {
  if (!options.confidenceReason && !options.degradedReason) {
    return null;
  }
  const reason = document.createElement('div');
  reason.className = `status-note${options.degradedReason ? ' is-degraded' : ''}`;
  reason.innerHTML = `
    <strong>${escapeHtml(options.degradedReason ? '可信度说明 / 降级提示' : '可信度说明')}</strong>
    <span>${escapeHtml([options.confidenceReason, options.degradedReason].filter(Boolean).join('；'))}</span>
  `;
  return reason;
}

function renderRecoveryActions(options) {
  if (!options.recoveryActions?.length) {
    return null;
  }
  const group = document.createElement('div');
  group.className = 'follow-up-group';

  const helper = document.createElement('span');
  helper.className = 'helper-inline';
  helper.textContent = '建议下一步';
  group.append(helper);

  options.recoveryActions.forEach((actionLabel) => {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'follow-up-chip';
    action.textContent = actionLabel;
    action.addEventListener('click', () => applyRecoveryAction(actionLabel));
    group.append(action);
  });
  return group;
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
  if (options.confidence === 'LOW') {
    return {
      tone: 'warning',
      title: '当前回答可信度较低',
      body: options.confidenceReason || '这次回答缺少足够证据，建议根据下面的动作重新组织问题。'
    };
  }
  if (options.degradedReason) {
    return {
      tone: 'degraded',
      title: '已使用降级链路',
      body: options.degradedReason
    };
  }
  if (!options.sources?.length) {
    return {
      tone: 'warning',
      title: '证据不足',
      body: options.confidenceReason || '这次回答没有检索到可靠证据，建议缩小范围、指定文档或更换关键词再问。'
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

function openCitationDrawer(index, sources = state.sources) {
  state.sources = sources;
  state.activeSourceIndex = index;
  setDetailView('sources');
  if (state.collapsed.evidence) {
    state.collapsed.evidence = false;
    renderPanelStates();
  }
  renderSources();
  syncValidationState();
  elements.citationDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const target = elements.sourceList.querySelector(`[data-source-index="${index}"]`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  elements.chatLog.querySelectorAll('.citation-chip').forEach((chip, chipIndex) => {
    chip.classList.toggle('is-active', chipIndex === index);
  });
}

function highlightSource(index, sources = state.sources) {
  openCitationDrawer(index, sources);
}

function retryLastQuestion() {
  if (state.loading || !state.lastQuestion) {
    return;
  }
  elements.questionInput.value = state.lastQuestion;
  handleQuestionInput();
  elements.questionInput.focus();
  elements.form.requestSubmit();
}

function openMessageActionMenu(content, options, anchor) {
  closeActionMenus();
  elements.messageActionMenu.innerHTML = '';

  const copyAnswerButton = document.createElement('button');
  copyAnswerButton.type = 'button';
  copyAnswerButton.className = 'action-menu-item';
  copyAnswerButton.textContent = '复制答案';
  copyAnswerButton.addEventListener('click', async () => {
    const copied = await copyTextToClipboard(content);
    flashRequestStatus(copied ? '答案已复制' : '答案复制失败');
    closeActionMenus();
  });
  elements.messageActionMenu.append(copyAnswerButton);

  if (options.sources?.length) {
    const viewEvidenceButton = document.createElement('button');
    viewEvidenceButton.type = 'button';
    viewEvidenceButton.className = 'action-menu-item';
    viewEvidenceButton.textContent = '定位首条证据';
    viewEvidenceButton.addEventListener('click', () => {
      openCitationDrawer(0, options.sources);
      closeActionMenus();
    });
    elements.messageActionMenu.append(viewEvidenceButton);

    const copyEvidenceButton = document.createElement('button');
    copyEvidenceButton.type = 'button';
    copyEvidenceButton.className = 'action-menu-item';
    copyEvidenceButton.textContent = '复制当前证据';
    copyEvidenceButton.addEventListener('click', () => {
      openEvidenceCopyMenu(state.activeSourceIndex ?? 0, anchor, options.sources);
    });
    elements.messageActionMenu.append(copyEvidenceButton);
  }

  if (options.trace?.length) {
    const viewTraceButton = document.createElement('button');
    viewTraceButton.type = 'button';
    viewTraceButton.className = 'action-menu-item';
    viewTraceButton.textContent = '查看执行轨迹';
    viewTraceButton.addEventListener('click', () => {
      focusDetailPanel('trace');
      closeActionMenus();
    });
    elements.messageActionMenu.append(viewTraceButton);
  }

  elements.messageActionMenu.hidden = false;
  positionActionMenu(elements.messageActionMenu, anchor);
}

function openEvidenceCopyMenu(sourceIndex, anchor, sources = state.sources) {
  closeActionMenus('message');
  elements.evidenceCopyMenu.innerHTML = '';
  elements.evidenceCopyMenu.dataset.sourceIndex = String(sourceIndex);
  elements.evidenceCopyMenu.dataset.sourceCount = String(sources.length);
  elements.evidenceCopyMenu.dataset.sourcePayload = encodeURIComponent(JSON.stringify(sources[sourceIndex] || sources[0] || null));

  const plainButton = document.createElement('button');
  plainButton.type = 'button';
  plainButton.className = 'action-menu-item';
  plainButton.textContent = '复制纯文本';
  plainButton.addEventListener('click', () => copyEvidenceAs('plain'));
  elements.evidenceCopyMenu.append(plainButton);

  const sourceButton = document.createElement('button');
  sourceButton.type = 'button';
  sourceButton.className = 'action-menu-item';
  sourceButton.textContent = '复制带来源';
  sourceButton.addEventListener('click', () => copyEvidenceAs('source'));
  elements.evidenceCopyMenu.append(sourceButton);

  const markdownButton = document.createElement('button');
  markdownButton.type = 'button';
  markdownButton.className = 'action-menu-item';
  markdownButton.textContent = '复制 Markdown';
  markdownButton.addEventListener('click', () => copyEvidenceAs('markdown'));
  elements.evidenceCopyMenu.append(markdownButton);

  elements.evidenceCopyMenu.hidden = false;
  positionActionMenu(elements.evidenceCopyMenu, anchor);
}

function closeActionMenus(except) {
  if (except !== 'message') {
    elements.messageActionMenu.hidden = true;
    elements.messageActionMenu.innerHTML = '';
  }
  if (except !== 'evidence') {
    elements.evidenceCopyMenu.hidden = true;
    elements.evidenceCopyMenu.innerHTML = '';
    delete elements.evidenceCopyMenu.dataset.sourceIndex;
    delete elements.evidenceCopyMenu.dataset.sourcePayload;
  }
}

function positionActionMenu(menu, anchor) {
  const rect = anchor.getBoundingClientRect();
  const menuWidth = 220;
  const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.left));
  const top = Math.min(window.innerHeight - 16, rect.bottom + 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

async function copyEvidenceAs(format) {
  const source = resolveEvidenceSource();
  if (!source) {
    flashRequestStatus('当前没有可复制证据');
    closeActionMenus();
    return false;
  }

  const copied = await copyTextToClipboard(formatEvidenceForCopy(format, source));
  flashRequestStatus(copied ? '证据已复制' : '证据复制失败');
  closeActionMenus();
  return copied;
}

function resolveEvidenceSource() {
  const rawPayload = elements.evidenceCopyMenu.dataset.sourcePayload;
  if (rawPayload) {
    try {
      return JSON.parse(decodeURIComponent(rawPayload));
    } catch (error) {
    }
  }
  const sourceIndex = Number(elements.evidenceCopyMenu.dataset.sourceIndex ?? state.activeSourceIndex ?? 0);
  return state.sources[sourceIndex] || state.sources[0] || null;
}

function formatEvidenceForCopy(format, source) {
  if (format === 'plain') {
    return source.excerpt || '';
  }
  if (format === 'markdown') {
    return [
      `> ${source.excerpt || ''}`,
      '',
      `Source: **${source.title || source.sourceId || '未知来源'}**`,
      '',
      `Path: \`${source.sourceId || 'unknown'}\``
    ].join('\n');
  }
  return [
    source.title || source.sourceId || '未知来源',
    source.sourceId || 'unknown',
    '',
    source.excerpt || ''
  ].join('\n');
}

function flashRequestStatus(message) {
  const previous = elements.requestStatusBadge.textContent;
  elements.requestStatusBadge.textContent = message;
  window.setTimeout(() => {
    elements.requestStatusBadge.textContent = previous;
  }, 1600);
}

function startStreamingState() {
  state.loading = true;
  state.lastResponseConfidence = '';
  state.sources = [];
  state.trace = [];
  state.activeSourceIndex = null;
  state.stages = createStageStateMap();
  renderStageStrip();
  renderSources({ loading: true });
  renderTrace({ loading: true });
  elements.currentStageLabel.textContent = getMessage('status.building', '建立链路');
  elements.requestStatusBadge.textContent = getMessage('status.processing', '处理中');
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
  elements.questionInput.disabled = disabled;
  elements.newConversationButton.disabled = disabled;
  syncQuestionExperience();
}

function togglePanel(key) {
  if (key === 'left' && state.viewportMode === 'mobile') {
    toggleDocDrawer();
    return;
  }
  state.collapsed[key] = !state.collapsed[key];
  renderPanelStates();
}

function renderPanelStates() {
  if (state.viewportMode !== 'desktop') {
    state.collapsed.evidence = false;
    state.collapsed.audit = false;
  }
  const leftCollapsed = state.viewportMode === 'mobile' ? false : state.collapsed.left;
  applyPanelState(elements.leftPanelShell, elements.toggleLeftPanel, leftCollapsed, 'leftPanelBody');
  applyPanelState(elements.evidencePanelShell, elements.toggleEvidencePanel, state.collapsed.evidence, 'evidencePanelBody');
  applyPanelState(elements.auditPanelShell, elements.toggleAuditPanel, state.collapsed.audit, 'auditPanelBody');
  document.body.dataset.viewportMode = state.viewportMode;
  document.body.dataset.detailView = state.detailView;
  document.body.dataset.docDrawerOpen = String(state.docDrawerOpen && state.viewportMode === 'mobile' && !state.focusMode);
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
      state.docDrawerOpen = false;
    } else {
      state.collapsed.left = true;
      state.collapsed.evidence = false;
      state.collapsed.audit = false;
      state.detailView = 'sources';
      state.docDrawerOpen = false;
    }
  }
  if (previousMode !== nextMode) {
    state.promptCollapsed = nextMode === 'mobile';
  }
  renderStageStrip();
  renderJourneyPanel();
  renderPromptToggle();
  renderDocDrawer();
  renderDetailTabs();
  renderPanelStates();
  updateJumpLatestButton();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const isDark = state.theme === 'dark';
  elements.themeToggle.classList.toggle('is-active', isDark);
  elements.themeToggle.setAttribute('aria-pressed', String(isDark));
  elements.themeToggle.innerHTML = isDark
    ? `${renderIconSprite('sun')}<span>${escapeHtml(getMessage('controls.themeLight', '浅色模式'))}</span>`
    : `${renderIconSprite('moon')}<span>${escapeHtml(getMessage('controls.themeDark', '深色模式'))}</span>`;
}

function applyFocusMode() {
  document.body.classList.toggle('is-focus-mode', state.focusMode);
  elements.focusToggle.classList.toggle('is-active', state.focusMode);
  elements.focusToggle.setAttribute('aria-pressed', String(state.focusMode));
  elements.focusToggle.innerHTML = state.focusMode
    ? `${renderIconSprite('compress')}<span>${escapeHtml(getMessage('controls.focusEnabled', '退出专注'))}</span>`
    : `${renderIconSprite('expand')}<span>${escapeHtml(getMessage('controls.focusDisabled', '专注对话'))}</span>`;
  elements.focusNotice.hidden = !state.focusMode;

  if (state.focusMode) {
    state.collapsed.left = true;
    state.collapsed.evidence = true;
    state.collapsed.audit = true;
    state.docDrawerOpen = false;
    renderDocDrawer();
    renderPanelStates();
    renderDetailTabs();
    return;
  }

  syncViewportMode(true);
}

function smoothScrollToLatest() {
  elements.chatLog.scrollTo({ top: elements.chatLog.scrollHeight, behavior: 'smooth' });
  window.setTimeout(updateJumpLatestButton, 180);
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

function readJsonValue(key, fallback) {
  const rawValue = loadStoredValue(key, '');
  if (!rawValue) {
    return fallback;
  }
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return fallback;
  }
}

function persistJsonValue(key, value) {
  persistValue(key, JSON.stringify(value));
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

function compactStageMessage(message, maxLength) {
  const normalized = String(message || '').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
}

function renderComposerContext() {
  const hasDoc = Boolean(state.selectedDoc);
  elements.composerContext.hidden = !hasDoc;
  renderAskBar();
  renderDocDrawer();
  if (!hasDoc) {
    return;
  }
  elements.selectedDocLabel.textContent = state.selectedDoc.label;
  elements.selectedDocPath.textContent = state.selectedDoc.path;
  renderAskBar();
}

function renderAskBar(descriptor = describeQuestionExperience(elements.questionInput.value.trim()), question = elements.questionInput.value.trim()) {
  const guideState = resolveGuideState(question, descriptor);
  const runtimeSummary = state.loading ? '状态：正在生成回答' : `运行模式：${state.runtimeStatus.label}`;
  const scopeSummary = state.selectedDoc
    ? `当前范围：${shortTitle(state.selectedDoc.label, 18)}`
    : '当前范围：全部知识库';
  const readinessSummary = state.lastResponseConfidence === 'LOW'
    ? '建议：先缩小范围再追问'
    : `发送准备：${descriptor.ready ? '可直接发送' : '建议补充上下文'}`;
  const shortcutSummary = state.loading
    ? '当前请求处理中，请稍候'
    : '快捷发送：Ctrl / ⌘ + Enter';

  elements.askBarStatus.innerHTML = '';
  elements.askBarStatus.append(elements.docDrawerToggle);
  [
    runtimeSummary,
    scopeSummary,
    readinessSummary,
    shortcutSummary
  ].forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'status-pill';
    chip.textContent = item;
    elements.askBarStatus.append(chip);
  });
  elements.askBar.dataset.guideState = guideState;
}

function toggleDocDrawer(forceOpen) {
  if (state.viewportMode !== 'mobile' || state.focusMode) {
    return;
  }
  state.docDrawerOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.docDrawerOpen;
  renderDocDrawer();
  renderPanelStates();
}

function renderDocDrawer() {
  const mobileDrawerEnabled = state.viewportMode === 'mobile' && !state.focusMode;
  const drawerOpen = mobileDrawerEnabled && state.docDrawerOpen;
  elements.docDrawerToggle.hidden = !mobileDrawerEnabled;
  elements.docDrawerToggle.setAttribute('aria-expanded', String(drawerOpen));
  elements.docDrawerToggle.textContent = state.selectedDoc
    ? `文档范围：${shortTitle(state.selectedDoc.label, 10)}`
    : '选择文档范围';
  elements.docDrawer.classList.toggle('is-open', drawerOpen);
  elements.docDrawerBackdrop.hidden = !mobileDrawerEnabled;
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

function resolveGuideState(question, descriptor) {
  if (state.loading) {
    return 'busy';
  }
  if (question) {
    return descriptor.ready ? 'hidden' : 'draft';
  }
  if (state.lastResponseConfidence === 'LOW') {
    return 'recovery';
  }
  if (!state.lastQuestion) {
    return 'welcome';
  }
  return 'hidden';
}

function renderContextualGuide(question = elements.questionInput.value.trim(), descriptor = describeQuestionExperience(question)) {
  const guideState = resolveGuideState(question, descriptor);
  const showGuide = guideState === 'welcome' || guideState === 'recovery';
  const headerEyebrow = elements.journeyPanel.querySelector('.journey-header .eyebrow');
  const headerTitle = elements.journeyPanel.querySelector('.journey-header h3');
  const headerChip = elements.journeyPanel.querySelector('.journey-actions .conversation-chip');
  const steps = Array.from(elements.journeyPanel.querySelectorAll('.journey-step'));
  const guideCopy = guideState === 'recovery'
    ? {
        eyebrow: 'Retry Plan',
        title: '这次答案可信度偏低，先修正问题再继续追问',
        chip: '优先缩小范围',
        steps: [
          { title: '先补关键条件', body: '补充系统名、时间范围、环境或目标动作，减少检索歧义。' },
          { title: '再限定资料范围', body: '如已知资料来源，先点左侧文档，让回答优先引用指定文档。' },
          { title: '最后检查证据', body: '重试后优先看证据条数和轨迹摘要，确认不是再次走低可信路径。' }
        ]
      }
    : {
        eyebrow: 'Quick Start',
        title: '把一次问答拆成 3 个轻动作',
        chip: '降低首问门槛',
        steps: [
          { title: '先限定范围', body: '可直接提问，也可先点左侧文档，让回答优先引用指定资料。' },
          { title: '再补充上下文', body: '写清系统名、时间范围、环境或目标动作，检索命中率会更高。' },
          { title: '最后快速复核', body: '回答出来后直接点证据、看轨迹，几秒内判断答案能不能用。' }
        ]
      };

  elements.askBar.dataset.guideState = guideState;
  elements.contextualGuide.hidden = !showGuide;
  if (!showGuide) {
    return;
  }

  headerEyebrow.textContent = guideCopy.eyebrow;
  headerTitle.textContent = guideCopy.title;
  headerChip.textContent = guideCopy.chip;
  steps.forEach((step, index) => {
    const titleNode = step.querySelector('h3');
    const bodyNode = step.querySelector('p');
    titleNode.textContent = guideCopy.steps[index].title;
    bodyNode.textContent = guideCopy.steps[index].body;
  });
  renderJourneyPanel();
}

function renderJourneyPanel() {
  const compact = !state.journeyCollapsed && state.viewportMode !== 'desktop';
  elements.journeyPanel.classList.toggle('is-collapsed', state.journeyCollapsed);
  elements.journeyPanel.classList.toggle('is-compact', compact);
  elements.journeyToggle.textContent = state.journeyCollapsed ? '展开引导' : '收起引导';
  elements.journeyToggle.setAttribute('aria-expanded', String(!state.journeyCollapsed));
}

function renderDetailTabs() {
  const tabbed = state.viewportMode !== 'desktop' && !state.focusMode;
  elements.detailTabs.hidden = !tabbed;
  elements.detailTabSources.classList.toggle('is-active', state.detailView === 'sources');
  elements.detailTabTrace.classList.toggle('is-active', state.detailView === 'trace');
  elements.detailTabSources.setAttribute('aria-selected', String(state.detailView === 'sources'));
  elements.detailTabTrace.setAttribute('aria-selected', String(state.detailView === 'trace'));
  syncValidationState();
}

function setDetailView(view) {
  state.detailView = view;
  renderDetailTabs();
  renderPanelStates();
  syncValidationState();
}

function renderValidationWorkbench() {
  renderValidationSummary();
  syncValidationState();
}

function renderValidationSummary() {
  const sourceCount = state.responseMeta.matchedDocuments || state.sources.length;
  const traceCount = state.trace.length;
  const activeSource = state.sources[state.activeSourceIndex ?? 0] || null;
  const degraded = Boolean(state.responseMeta.degradedReason)
    || state.runtimeStatus.code === 'degraded'
    || state.trace.some((step) => step.severity === 'degraded');
  const confidenceLabel = state.lastResponseConfidence
    ? localizeConfidence(state.lastResponseConfidence)
    : '待生成';
  const scannedCount = state.responseMeta.documentsScanned || 0;

  const cards = [
    {
      label: '证据概览',
      value: sourceCount ? `${sourceCount} 条证据 / 已扫描 ${scannedCount} 条候选` : scannedCount ? `已扫描 ${scannedCount} 条候选` : '暂无线索',
      body: activeSource ? `当前聚焦：${activeSource.title}` : '点击回答中的引用后，这里会直接高亮对应片段。',
      tone: sourceCount ? 'ready' : 'warning'
    },
    {
      label: '轨迹概览',
      value: traceCount ? `${traceCount} 个阶段摘要` : '暂无轨迹',
      body: state.responseMeta.selectedStrategy
        ? `当前策略：${state.responseMeta.selectedStrategy}。规划、检索、研究和生成会按阶段同步到右栏。`
        : traceCount ? '规划、检索、研究和生成会按阶段同步到右栏。' : '提问后会生成阶段摘要与降级提示。',
      tone: traceCount ? 'ready' : ''
    },
    {
      label: '运行状态',
      value: state.runtimeStatus.label,
      body: [confidenceLabel, state.responseMeta.confidenceReason || '', degraded ? (state.responseMeta.degradedReason || '已检测到降级链路') : '当前链路正常']
        .filter(Boolean)
        .join(' / '),
      tone: degraded ? 'degraded' : 'ready'
    }
  ];

  elements.validationSummary.innerHTML = cards.map((card) => `
    <article class="validation-card${card.tone ? ` is-${card.tone}` : ''}">
      <span class="meta-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `).join('');
}

function syncValidationState() {
  const activeSource = state.sources[state.activeSourceIndex ?? 0] || null;
  elements.validationWorkbench.dataset.detailView = state.detailView;
  elements.validationWorkbench.dataset.hasSources = String(Boolean(state.sources.length));
  elements.validationWorkbench.dataset.hasTrace = String(Boolean(state.trace.length));
  elements.citationDrawer.dataset.open = String(Boolean(activeSource));
  elements.validationTimeline.dataset.hasTrace = String(Boolean(state.trace.length));
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
  renderAskBar();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function flashActionLabel(button, text) {
  const previousLabel = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = previousLabel;
  }, 1600);
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
