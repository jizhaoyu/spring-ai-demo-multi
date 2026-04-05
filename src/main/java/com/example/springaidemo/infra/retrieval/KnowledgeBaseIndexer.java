package com.example.springaidemo.infra.retrieval;

import com.example.springaidemo.domain.tool.KnowledgeCatalogNode;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import com.example.springaidemo.domain.tool.KnowledgeDocumentSummary;
import com.example.springaidemo.domain.tool.RuntimeStatus;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

@Component
public class KnowledgeBaseIndexer {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseIndexer.class);
    private static final String ROOT_LABEL = "默认知识库";

    private final KnowledgeBaseProperties properties;
    private final List<KnowledgeDocumentSummary> catalog = new ArrayList<>();
    private final List<KnowledgeChunk> chunks = new ArrayList<>();
    private RuntimeStatus runtimeStatus = RuntimeStatus.offline("知识库正在初始化。");

    public KnowledgeBaseIndexer(KnowledgeBaseProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void initialize() {
        this.catalog.clear();
        this.chunks.clear();

        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources(this.properties.getResourcePattern());
            for (Resource resource : resources) {
                String body = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
                String sourceId = extractSourceId(resource);
                String title = extractTitle(body, resource.getFilename());
                String summary = extractSummary(body);
                this.catalog.add(new KnowledgeDocumentSummary(sourceId, title, summary));

                List<KnowledgeChunk> chunkList = chunk(sourceId, title, summary, body);
                this.chunks.addAll(chunkList);
            }

            this.catalog.sort(Comparator.comparing(KnowledgeDocumentSummary::sourceId));
            if (this.catalog.isEmpty()) {
                this.runtimeStatus = RuntimeStatus.offline("未发现知识库文档，当前只能使用基础问答能力。");
                log.warn("No knowledge base documents matched {}", this.properties.getResourcePattern());
                return;
            }

            this.runtimeStatus = RuntimeStatus.normal("知识库已就绪，可浏览目录并引用证据。");
            log.info("Indexed {} knowledge documents into {} local chunks", this.catalog.size(), this.chunks.size());
        } catch (IOException exception) {
            this.runtimeStatus = RuntimeStatus.offline("知识库目录加载失败，请检查文档资源后重试。");
            log.warn("Failed to initialize knowledge base catalog", exception);
        }
    }

    public KnowledgeCatalogPayload catalogPayload(RuntimeStatus runtimeStatusOverride) {
        MutableNode root = new MutableNode("root", ROOT_LABEL, "", "FOLDER", "知识库根目录");
        for (KnowledgeDocumentSummary document : this.catalog) {
            addDocument(root, document);
        }
        RuntimeStatus effectiveStatus = runtimeStatusOverride == null ? this.runtimeStatus : runtimeStatusOverride;
        return new KnowledgeCatalogPayload(
                ROOT_LABEL,
                this.catalog.size(),
                root.children().values().stream().map(MutableNode::toCatalogNode).toList(),
                effectiveStatus
        );
    }

    public List<KnowledgeDocumentSummary> documents() {
        return List.copyOf(this.catalog);
    }

    public List<KnowledgeChunk> chunks() {
        return List.copyOf(this.chunks);
    }

    public boolean hasSearchableContent() {
        return !this.chunks.isEmpty();
    }

    public RuntimeStatus baseStatus() {
        return this.runtimeStatus;
    }

    private void addDocument(MutableNode root, KnowledgeDocumentSummary document) {
        String[] segments = document.sourceId().split("/");
        MutableNode current = root;
        StringBuilder pathBuilder = new StringBuilder();
        for (int index = 0; index < segments.length; index++) {
            String segment = segments[index];
            if (pathBuilder.length() > 0) {
                pathBuilder.append('/');
            }
            pathBuilder.append(segment);
            boolean isLeaf = index == segments.length - 1;
            String path = pathBuilder.toString();
            if (isLeaf) {
                current.children().put(path, new MutableNode(
                        path,
                        document.title(),
                        path,
                        "DOCUMENT",
                        document.summary()
                ));
            } else {
                current = current.children().computeIfAbsent(path, ignored -> new MutableNode(
                        path,
                        prettifyFolderName(segment),
                        path,
                        "FOLDER",
                        "目录"
                ));
            }
        }
    }

    private String prettifyFolderName(String segment) {
        return switch (segment) {
            case "operations" -> "运维";
            case "platform" -> "平台";
            case "support" -> "支持";
            default -> segment.replace('-', ' ');
        };
    }

    private String extractSourceId(Resource resource) throws IOException {
        String[] candidates = new String[] {
                safe(resource.getURL()),
                resource.getDescription(),
                resource.getFilename()
        };
        for (String candidate : candidates) {
            if (candidate == null) {
                continue;
            }
            int markerIndex = candidate.lastIndexOf("knowledge-base/");
            if (markerIndex >= 0) {
                String relative = candidate.substring(markerIndex + "knowledge-base/".length());
                relative = relative.replace('\\', '/').replace("]", "");
                return relative;
            }
        }
        return resource.getFilename();
    }

    private String safe(URL url) {
        return url == null ? null : url.toString();
    }

    private List<KnowledgeChunk> chunk(String sourceId, String title, String summary, String body) {
        List<KnowledgeChunk> result = new ArrayList<>();
        List<String> paragraphs = splitParagraphs(body);
        StringBuilder buffer = new StringBuilder();
        int chunkIndex = 1;
        for (String paragraph : paragraphs) {
            if (buffer.length() > 0 && buffer.length() + paragraph.length() > this.properties.getChunkSize()) {
                result.add(new KnowledgeChunk(sourceId, title, summary, chunkIndex++, buffer.toString()));
                buffer.setLength(0);
            }
            if (buffer.length() > 0) {
                buffer.append(System.lineSeparator()).append(System.lineSeparator());
            }
            buffer.append(paragraph);
        }
        if (buffer.length() > 0) {
            result.add(new KnowledgeChunk(sourceId, title, summary, chunkIndex, buffer.toString()));
        }
        return result;
    }

    private List<String> splitParagraphs(String text) {
        String[] sections = text.split("(?:\\r?\\n){2,}");
        List<String> paragraphs = new ArrayList<>();
        for (String section : sections) {
            String trimmed = section.trim();
            if (!trimmed.isEmpty()) {
                paragraphs.add(trimmed);
            }
        }
        return paragraphs;
    }

    private String extractTitle(String body, String fallback) {
        for (String line : body.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        return fallback == null ? "Knowledge Document" : fallback.replace(".md", "");
    }

    private String extractSummary(String body) {
        for (String block : body.split("(?:\\r?\\n){2,}")) {
            String candidate = block.replace("#", "").replace("*", "").trim();
            if (!candidate.isBlank()) {
                return candidate;
            }
        }
        return "Knowledge snippet";
    }

    public record KnowledgeChunk(
            String sourceId,
            String title,
            String summary,
            int chunkIndex,
            String content
    ) {
    }

    private static final class MutableNode {

        private final String id;
        private final String label;
        private final String path;
        private final String type;
        private final String summary;
        private final Map<String, MutableNode> children = new LinkedHashMap<>();

        private MutableNode(String id, String label, String path, String type, String summary) {
            this.id = id;
            this.label = label;
            this.path = path;
            this.type = type;
            this.summary = summary;
        }

        private Map<String, MutableNode> children() {
            return this.children;
        }

        private KnowledgeCatalogNode toCatalogNode() {
            return new KnowledgeCatalogNode(
                    this.id,
                    this.label,
                    this.path,
                    this.type,
                    this.summary,
                    this.children.values().stream().map(MutableNode::toCatalogNode).toList()
            );
        }
    }
}
