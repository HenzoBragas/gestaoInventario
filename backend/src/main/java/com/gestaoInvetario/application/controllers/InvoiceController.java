package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceFile;
import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceRequest;
import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.service.InvoiceService;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Notas fiscais de compra e o anexo da NF-e (PDF, XML ou imagem, ate 5 MB). */
@RestController
@RequestMapping("/invoices")
public class InvoiceController {

    private final InvoiceService service;

    public InvoiceController(InvoiceService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<InvoiceResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer productId,
            @RequestParam(required = false) Integer employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String dir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.search(q, productId, employeeId, from, to, sort, dir, page, size);
    }

    @GetMapping("/{id}")
    public InvoiceResponse get(@PathVariable Integer id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<InvoiceResponse> create(@Valid @RequestBody InvoiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public InvoiceResponse update(@PathVariable Integer id, @Valid @RequestBody InvoiceRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping(value = "/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InvoiceResponse attach(@PathVariable Integer id, @RequestPart("file") MultipartFile file) {
        return service.attach(id, file);
    }

    @DeleteMapping("/{id}/file")
    public InvoiceResponse detach(@PathVariable Integer id) {
        return service.detach(id);
    }

    /** Sempre como download (attachment): o conteudo enviado pelo usuario nunca e exibido inline. */
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> download(@PathVariable Integer id) {
        InvoiceFile file = service.file(id);
        String ascii = file.name().replaceAll("[^\\x20-\\x7E]", "_").replace("\"", "_");
        String encoded = URLEncoder.encode(file.name(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.type()))
                .contentLength(file.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encoded)
                .header("X-Content-Type-Options", "nosniff")
                .body(file.content());
    }
}
