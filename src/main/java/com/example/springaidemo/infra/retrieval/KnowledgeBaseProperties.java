package com.example.springaidemo.infra.retrieval;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "assistant.knowledge-base")
public class KnowledgeBaseProperties {

    private String resourcePattern = "classpath*:knowledge-base/*.md";
    private int topK = 4;
    private double minScore = 0.55;
    private int chunkSize = 700;

    public String getResourcePattern() {
        return this.resourcePattern;
    }

    public void setResourcePattern(String resourcePattern) {
        this.resourcePattern = resourcePattern;
    }

    public int getTopK() {
        return this.topK;
    }

    public void setTopK(int topK) {
        this.topK = topK;
    }

    public double getMinScore() {
        return this.minScore;
    }

    public void setMinScore(double minScore) {
        this.minScore = minScore;
    }

    public int getChunkSize() {
        return this.chunkSize;
    }

    public void setChunkSize(int chunkSize) {
        this.chunkSize = chunkSize;
    }
}
