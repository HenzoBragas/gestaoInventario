package com.gestaoInvetario.application.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties(MarketplaceProperties.class)
public class AsyncConfig {

    public static final String MARKETPLACE_EXECUTOR = "marketplaceExecutor";

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    /**
     * Pool dedicado: chamadas lentas aos marketplaces nao competem com as requisicoes HTTP.
     * Com a fila cheia a tarefa e descartada sem perda: o pedido continua PENDING no banco
     * e a varredura periodica o processa.
     */
    @Bean(MARKETPLACE_EXECUTOR)
    public ThreadPoolTaskExecutor marketplaceExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("marketplace-");
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setRejectedExecutionHandler((task, pool) ->
                log.warn("Fila de pedidos de marketplace cheia; o pedido sera processado na proxima varredura."));
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        return executor;
    }
}
