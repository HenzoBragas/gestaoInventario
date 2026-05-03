package com.gestaoInvetario.application;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

@SpringBootApplication
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	@EventListener(ApplicationReadyEvent.class)
	public void applicationStarted() {
		System.out.println("==================================================");
		System.out.println("✅ A aplicação StockTrack está rodando na porta 8080");
		System.out.println("📌 Acesse: http://localhost:8080");
		System.out.println("==================================================");

	}


}

