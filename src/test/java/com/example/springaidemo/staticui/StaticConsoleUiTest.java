package com.example.springaidemo.staticui;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;

class StaticConsoleUiTest {

    @Test
    void indexHtmlExposesBusinessFriendlyContextAndDetailShells() throws IOException {
        String html = readResource("static/index.html");

        assertThat(html).contains(
                "id=\"runtimeBanner\"",
                "id=\"newConversationButton\"",
                "href=\"#mainContent\"",
                "id=\"skipToMain\"",
                "id=\"mainContent\"",
                "id=\"askBar\"",
                "id=\"askBarStatus\"",
                "id=\"contextualGuide\"",
                "id=\"exampleQuestionRail\"",
                "id=\"composerContext\"",
                "id=\"detailTabs\"",
                "id=\"focusNotice\"",
                "id=\"promptToggle\"",
                "id=\"shortcutHelpDialog\"",
                "id=\"messageActionMenu\"",
                "id=\"evidenceCopyMenu\"",
                "id=\"validationWorkbench\"",
                "id=\"validationSummary\"",
                "id=\"citationDrawer\"",
                "id=\"validationTimeline\"",
                "id=\"selectedDocLabel\"",
                "id=\"clearDocContext\"",
                "id=\"journeyPanel\"",
                "id=\"journeyToggle\"",
                "id=\"worksetTabs\"",
                "id=\"recentDocsList\"",
                "id=\"pinnedDocsList\"",
                "id=\"docDrawerToggle\"",
                "id=\"docDrawer\"",
                "id=\"docSelectionState\"",
                "id=\"questionReadinessState\"",
                "id=\"questionQualityLabel\"",
                "id=\"conversationHelper\"",
                "id=\"draftStatusBadge\"",
                "id=\"clearDraftButton\"",
                "id=\"jumpLatestButton\""
        );
        assertThat(html).doesNotContain(
                "fonts.googleapis.com",
                "fonts.gstatic.com",
                "cdnjs.cloudflare.com"
        );
    }

    @Test
    void appScriptWiresRuntimeSummaryAndMobileDetailInteractions() throws IOException {
        String script = readResource("static/app.js");

        assertThat(script).contains(
                "applyRuntimeStatus",
                "followUpQuestions",
                "createAnswerSummary",
                "renderPromptToggle",
                "renderAskBar",
                "renderContextualGuide",
                "resolveGuideState",
                "retryLastQuestion",
                "summary-chip is-degraded",
                "DRAFT_STORAGE_KEY",
                "JOURNEY_STORAGE_KEY",
                "RECENT_DOCS_STORAGE_KEY",
                "PINNED_DOCS_STORAGE_KEY",
                "handleQuestionKeydown",
                "handleGlobalShortcut",
                "openShortcutHelp",
                "syncQuestionExperience",
                "toggleDocDrawer",
                "renderWorksets",
                "renderValidationWorkbench",
                "openCitationDrawer",
                "syncValidationState",
                "renderValidationSummary",
                "renderRecoveryActions",
                "renderConfidenceReason",
                "updateJumpLatestButton",
                "renderConversationBadge",
                "resetConversationState",
                "createPanelEmptyState",
                "bindEmptyStateActions",
                "renderJourneyPanel",
                "createMessageActions",
                "compactStageMessage",
                "copyTextToClipboard",
                "copyEvidenceAs('plain')",
                "copyEvidenceAs('source')",
                "copyEvidenceAs('markdown')",
                "documentsScanned",
                "matchedDocuments",
                "const messages = { zhCN:",
                "getMessage(",
                "renderIconSprite",
                "elements.detailTabSources.addEventListener('click', () => setDetailView('sources'));",
                "elements.detailTabTrace.addEventListener('click', () => setDetailView('trace'));",
                "elements.composerContext.hidden = !hasDoc;",
                "elements.newConversationButton.addEventListener('click', resetConversationState);",
                "elements.journeyToggle.addEventListener('click', () => {",
                "elements.runtimeBanner.dataset.status = state.runtimeStatus.code;",
                "elements.askBar.dataset.guideState = guideState;",
                "elements.contextualGuide.hidden = !showGuide;",
                "setDetailView('sources');",
                "persistValue(DRAFT_STORAGE_KEY, elements.questionInput.value);",
                "elements.jumpLatestButton.addEventListener('click', smoothScrollToLatest);",
                "title=\"${escapeHtml(fullMessage)}\"",
                "messageCount > 2"
        );
    }

    @Test
    void stylesDefineResponsiveTabsCompactStagesAndStateNotes() throws IOException {
        String styles = readResource("static/styles.css");

        assertThat(styles).contains(
                "[hidden] {",
                ".detail-tabs {",
                ".prompt-toggle {",
                ".ask-bar {",
                ".ask-bar-status {",
                ".contextual-guide {",
                ".example-question-rail {",
                ".validation-workbench {",
                ".citation-drawer {",
                ".validation-summary {",
                ".stage-stepper {",
                ".stage-spotlight {",
                ".summary-chip.is-degraded {",
                ".status-note.is-warning {",
                ".status-note.is-degraded {",
                ".journey-actions,",
                ".journey-panel.is-compact .journey-grid {",
                ".journey-panel {",
                ".composer-assist {",
                ".meta-helper {",
                ".rich-empty-state {",
                ".empty-actions {",
                ".assist-stat.is-ready {",
                ".chat-shell {",
                ".jump-latest {",
                ".message-actions,",
                ".stage-card .stage-caption,",
                ".trace-card h3 {",
                "@media (max-width: 1260px)",
                "body[data-viewport-mode=\"tablet\"][data-detail-view=\"sources\"] #evidencePanelShell",
                "@media (max-width: 860px)"
        );
    }

    private String readResource(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
    }
}
