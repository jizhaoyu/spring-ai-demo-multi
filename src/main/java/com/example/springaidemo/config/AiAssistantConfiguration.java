package com.example.springaidemo.config;

import com.example.springaidemo.infra.retrieval.KnowledgeBaseProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.SimpleAsyncTaskExecutor;

@Configuration
@EnableConfigurationProperties(KnowledgeBaseProperties.class)
public class AiAssistantConfiguration {

    @Bean
    AsyncTaskExecutor assistantStreamExecutor() {
        SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor("assistant-stream-");
        executor.setVirtualThreads(true);
        return executor;
    }
}
