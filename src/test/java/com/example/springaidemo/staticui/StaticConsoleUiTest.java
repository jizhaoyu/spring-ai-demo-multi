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
                "id=\"composerContext\"",
                "id=\"detailTabs\"",
                "id=\"focusNotice\"",
                "id=\"promptToggle\"",
                "id=\"selectedDocLabel\"",
                "id=\"clearDocContext\""
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
                "retryLastQuestion",
                "summary-chip is-degraded",
                "elements.detailTabSources.addEventListener('click', () => setDetailView('sources'));",
                "elements.detailTabTrace.addEventListener('click', () => setDetailView('trace'));",
                "elements.composerContext.hidden = !hasDoc;",
                "elements.runtimeBanner.dataset.status = state.runtimeStatus.code;",
                "setDetailView('sources');"
        );
    }

    @Test
    void stylesDefineResponsiveTabsCompactStagesAndStateNotes() throws IOException {
        String styles = readResource("static/styles.css");

        assertThat(styles).contains(
                ".detail-tabs {",
                ".prompt-toggle {",
                ".stage-stepper {",
                ".stage-spotlight {",
                ".summary-chip.is-degraded {",
                ".status-note.is-warning {",
                ".status-note.is-degraded {",
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
