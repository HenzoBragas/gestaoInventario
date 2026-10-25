package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceFile;
import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceRequest;
import com.gestaoInvetario.application.dtos.InvoiceDtos.InvoiceResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.Invoice;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.repositories.InvoiceRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Notas fiscais de compra. A auditoria e feita pelo trigger do banco; aqui as alteracoes usam
 * UPDATE direto para nunca carregar nem regravar o anexo sem necessidade.
 */
@Service
public class InvoiceService {

    private static final String SELECT = """
            select i.id, i.number, i.purchasePlace, i.amount, i.paymentDate, p.id, p.code, p.name, e.id, e.name,
                   i.fileName, i.fileType, i.fileSize, i.createdAt, i.updatedAt
            from Invoice i join i.product p join i.employee e""";
    private static final String FROM = " from Invoice i join i.product p join i.employee e";

    private static final Map<String, String> SORTS = Map.of(
            "paymentDate", "i.paymentDate",
            "amount", "i.amount",
            "number", "i.number",
            "product", "p.name",
            "purchasePlace", "i.purchasePlace",
            "createdAt", "i.createdAt");

    private final InvoiceRepository repository;
    private final ProductRepository products;
    private final AppUserRepository users;
    private final EntityManager entityManager;

    public InvoiceService(InvoiceRepository repository, ProductRepository products, AppUserRepository users,
                          EntityManager entityManager) {
        this.repository = repository;
        this.products = products;
        this.users = users;
        this.entityManager = entityManager;
    }

    // ------------------------------------------------------------------ consultas

    @Transactional(readOnly = true)
    public PageResponse<InvoiceResponse> search(String query, Integer productId, Integer employeeId, LocalDate from,
                                                LocalDate to, String sort, String dir, int page, int size) {
        StringBuilder where = new StringBuilder(" where 1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (query != null && !query.isBlank()) {
            where.append(" and (lower(i.number) like :q or lower(i.purchasePlace) like :q"
                    + " or lower(p.name) like :q or lower(p.code) like :q)");
            params.put("q", "%" + query.trim().toLowerCase() + "%");
        }
        if (productId != null) {
            where.append(" and p.id = :productId");
            params.put("productId", productId);
        }
        if (employeeId != null) {
            where.append(" and e.id = :employeeId");
            params.put("employeeId", employeeId);
        }
        if (from != null) {
            where.append(" and i.paymentDate >= :from");
            params.put("from", from);
        }
        if (to != null) {
            where.append(" and i.paymentDate <= :to");
            params.put("to", to);
        }
        String order = " order by " + (sort == null ? "i.paymentDate" : SORTS.getOrDefault(sort, "i.paymentDate"))
                + ("asc".equalsIgnoreCase(dir) ? " asc" : " desc") + ", i.id desc";

        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        TypedQuery<Object[]> rows = entityManager.createQuery(SELECT + where + order, Object[].class)
                .setFirstResult(safePage * safeSize)
                .setMaxResults(safeSize);
        TypedQuery<Long> count = entityManager.createQuery("select count(i)" + FROM + where, Long.class);
        params.forEach((key, value) -> {
            rows.setParameter(key, value);
            count.setParameter(key, value);
        });
        long total = count.getSingleResult();
        List<InvoiceResponse> items = rows.getResultList().stream().map(InvoiceService::toResponse).toList();
        return new PageResponse<>(items, safePage, safeSize, total, (int) Math.ceil(total / (double) safeSize));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(Integer id) {
        return entityManager.createQuery(SELECT + " where i.id = :id", Object[].class)
                .setParameter("id", id)
                .getResultStream()
                .findFirst()
                .map(InvoiceService::toResponse)
                .orElseThrow(() -> ApiException.notFound("Nota fiscal"));
    }

    @Transactional(readOnly = true)
    public InvoiceFile file(Integer id) {
        Object[] row = entityManager.createQuery("select i.file, i.fileName, i.fileType from Invoice i where i.id = :id", Object[].class)
                .setParameter("id", id)
                .getResultStream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Nota fiscal"));
        if (row[0] == null) {
            throw ApiException.notFound("Anexo da nota fiscal");
        }
        return new InvoiceFile((byte[]) row[0], (String) row[1], (String) row[2]);
    }

    // ------------------------------------------------------------------ escrita

    @Transactional
    public InvoiceResponse create(InvoiceRequest request) {
        Invoice invoice = new Invoice();
        invoice.setNumber(request.number().trim());
        invoice.setPurchasePlace(request.purchasePlace().trim());
        invoice.setAmount(request.amount());
        invoice.setPaymentDate(request.paymentDate());
        invoice.setProduct(product(request.productId()));
        invoice.setEmployee(employee(request.employeeId(), null));
        return get(repository.save(invoice).getId());
    }

    @Transactional
    public InvoiceResponse update(Integer id, InvoiceRequest request) {
        Integer currentEmployee = entityManager.createQuery("select i.employee.id from Invoice i where i.id = :id", Integer.class)
                .setParameter("id", id)
                .getResultStream()
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Nota fiscal"));
        entityManager.createQuery("""
                        update Invoice i set i.number = :number, i.purchasePlace = :place, i.amount = :amount,
                            i.paymentDate = :paymentDate, i.product = :product, i.employee = :employee, i.updatedAt = :now
                        where i.id = :id""")
                .setParameter("number", request.number().trim())
                .setParameter("place", request.purchasePlace().trim())
                .setParameter("amount", request.amount())
                .setParameter("paymentDate", request.paymentDate())
                .setParameter("product", product(request.productId()))
                .setParameter("employee", employee(request.employeeId(), currentEmployee))
                .setParameter("now", Instant.now())
                .setParameter("id", id)
                .executeUpdate();
        return get(id);
    }

    @Transactional
    public void delete(Integer id) {
        if (!repository.existsById(id)) {
            throw ApiException.notFound("Nota fiscal");
        }
        repository.deleteById(id);
    }

    @Transactional
    public InvoiceResponse attach(Integer id, MultipartFile upload) {
        if (!repository.existsById(id)) {
            throw ApiException.notFound("Nota fiscal");
        }
        if (upload == null || upload.isEmpty()) {
            throw ApiException.unprocessable("FILE_EMPTY", "Selecione o arquivo da nota.", "file");
        }
        if (upload.getSize() > Invoice.MAX_FILE_BYTES) {
            throw tooLarge();
        }
        byte[] content;
        try {
            content = upload.getBytes();
        } catch (IOException e) {
            throw ApiException.unprocessable("FILE_UNREADABLE", "Não foi possível ler o arquivo enviado.", "file");
        }
        FileKind kind = FileKind.detect(content);
        if (kind == null) {
            throw ApiException.unprocessable("FILE_TYPE", "Envie a nota em PDF, XML, PNG ou JPG.", "file");
        }
        writeFile(id, content, fileName(upload.getOriginalFilename(), kind, id), kind.mime, content.length);
        return get(id);
    }

    @Transactional
    public InvoiceResponse detach(Integer id) {
        if (!repository.existsById(id)) {
            throw ApiException.notFound("Nota fiscal");
        }
        writeFile(id, null, null, null, null);
        return get(id);
    }

    public static ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "O arquivo deve ter no máximo 5 MB.");
    }

    // ------------------------------------------------------------------ apoio

    private void writeFile(Integer id, byte[] content, String name, String type, Integer size) {
        Query update = entityManager.createQuery("""
                update Invoice i set i.file = :file, i.fileName = :name, i.fileType = :type, i.fileSize = :size,
                    i.updatedAt = :now
                where i.id = :id""");
        update.setParameter("file", content)
                .setParameter("name", name)
                .setParameter("type", type)
                .setParameter("size", size)
                .setParameter("now", Instant.now())
                .setParameter("id", id)
                .executeUpdate();
    }

    private Product product(Integer id) {
        return products.findById(id)
                .orElseThrow(() -> ApiException.unprocessable("PRODUCT_NOT_FOUND", "Produto não encontrado.", "productId"));
    }

    /** O responsavel deve estar ativo, exceto se ja era o responsavel da nota (edicao de nota antiga). */
    private AppUser employee(Integer id, Integer currentId) {
        AppUser user = users.findById(id)
                .orElseThrow(() -> ApiException.unprocessable("EMPLOYEE_NOT_FOUND", "Funcionário não encontrado.", "employeeId"));
        if (!user.isActive() && !id.equals(currentId)) {
            throw ApiException.unprocessable("EMPLOYEE_INACTIVE", "O funcionário selecionado está inativo.", "employeeId");
        }
        return user;
    }

    /** Nome original sem caminho nem caracteres especiais, com a extensao do tipo detectado. */
    static String fileName(String original, FileKind kind, Integer id) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1)
                .replaceAll("[^\\p{L}\\p{N}._ ()-]", "_")
                .replaceAll("\\s+", " ")
                .trim();
        if (name.isEmpty() || name.startsWith(".")) {
            name = "nota-fiscal-" + id;
        }
        if (!name.toLowerCase().endsWith(kind.extension)) {
            int dot = name.lastIndexOf('.');
            name = (dot > 0 ? name.substring(0, dot) : name) + kind.extension;
        }
        if (name.length() > 120) {
            name = name.substring(0, 120 - kind.extension.length()) + kind.extension;
        }
        return name;
    }

    private static InvoiceResponse toResponse(Object[] r) {
        return new InvoiceResponse((Integer) r[0], (String) r[1], (String) r[2], (BigDecimal) r[3], (LocalDate) r[4],
                (Integer) r[5], (String) r[6], (String) r[7], (Integer) r[8], (String) r[9], (String) r[10],
                (String) r[11], (Integer) r[12], (Instant) r[13], (Instant) r[14]);
    }

    /** Tipos aceitos, reconhecidos pelo conteudo (assinatura do arquivo), nao pela extensao. */
    enum FileKind {
        PDF("application/pdf", ".pdf"),
        PNG("image/png", ".png"),
        JPEG("image/jpeg", ".jpg"),
        XML("application/xml", ".xml");

        final String mime;
        final String extension;

        FileKind(String mime, String extension) {
            this.mime = mime;
            this.extension = extension;
        }

        static FileKind detect(byte[] b) {
            if (startsWith(b, 0, "%PDF-".getBytes(StandardCharsets.US_ASCII))) return PDF;
            if (startsWith(b, 0, new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})) return PNG;
            if (startsWith(b, 0, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})) return JPEG;
            // XML da NF-e: "<?xml" ou a tag raiz, opcionalmente apos BOM UTF-8 e espacos.
            int i = startsWith(b, 0, new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}) ? 3 : 0;
            while (i < b.length && Character.isWhitespace(b[i])) i++;
            if (i + 1 < b.length && b[i] == '<' && (b[i + 1] == '?' || Character.isLetter(b[i + 1]))) return XML;
            return null;
        }

        private static boolean startsWith(byte[] content, int offset, byte[] prefix) {
            if (content.length < offset + prefix.length) return false;
            for (int i = 0; i < prefix.length; i++) {
                if (content[offset + i] != prefix[i]) return false;
            }
            return true;
        }
    }
}
