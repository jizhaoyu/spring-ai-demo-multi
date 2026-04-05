package com.example.springaidemo.config;

import java.lang.reflect.Method;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class OpenAiBaseUrlSanitizerConfiguration {

    @Bean
    static BeanPostProcessor openAiBaseUrlSanitizer() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
                String className = bean.getClass().getName();
                if (!className.startsWith("org.springframework.ai.model.openai.autoconfigure.")) {
                    return bean;
                }
                normalizeBaseUrl(bean);
                return bean;
            }
        };
    }

    private static void normalizeBaseUrl(Object bean) {
        try {
            Method getter = bean.getClass().getMethod("getBaseUrl");
            Method setter = bean.getClass().getMethod("setBaseUrl", String.class);
            Object value = getter.invoke(bean);
            if (!(value instanceof String raw) || !StringUtils.hasText(raw)) {
                return;
            }
            String trimmed = raw.trim();
            String normalized = trimmed;
            if (normalized.endsWith("/v1")) {
                normalized = normalized.substring(0, normalized.length() - 3);
            }
            if (normalized.endsWith("/")) {
                normalized = normalized.substring(0, normalized.length() - 1);
            }
            if (!normalized.equals(trimmed)) {
                setter.invoke(bean, normalized);
            }
        }
        catch (NoSuchMethodException ignored) {
        }
        catch (Exception exception) {
            throw new IllegalStateException("Failed to normalize OpenAI base URL", exception);
        }
    }
}
