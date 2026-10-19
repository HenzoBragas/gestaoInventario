package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.CatalogDtos.CategoryRequest;
import com.gestaoInvetario.application.dtos.CatalogDtos.CategoryResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Category;
import com.gestaoInvetario.application.repositories.CategoryRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import jakarta.persistence.EntityManager;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository repository;
    private final ProductRepository productRepository;
    private final AuditService audit;
    private final EntityManager entityManager;

    public CategoryService(CategoryRepository repository, ProductRepository productRepository, AuditService audit,
                           EntityManager entityManager) {
        this.repository = repository;
        this.productRepository = productRepository;
        this.audit = audit;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getAll() {
        Map<Integer, Long> counts = productCounts();
        return repository.findAll().stream()
                .sorted(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
                .map(c -> toDTO(c, counts.getOrDefault(c.getSeq(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getById(Integer id) {
        Category category = find(id);
        return toDTO(category, productRepository.countByCategory_Seq(id));
    }

    @Transactional
    public CategoryResponse create(CategoryRequest dto) {
        String name = dto.name().trim();
        if (repository.findByNameIgnoreCase(name).isPresent()) {
            throw ApiException.conflict("CATEGORY_EXISTS", "Já existe uma categoria com esse nome.", "name");
        }
        Category category = new Category(null, name, dto.inactive() != null ? dto.inactive() : 0,
                blankToNull(dto.description()));
        Category saved = repository.save(category);
        audit.record("CATEGORIA", saved.getSeq(), "CRIACAO", "Categoria " + name + " criada.");
        return toDTO(saved, 0);
    }

    @Transactional
    public CategoryResponse update(Integer id, CategoryRequest dto) {
        Category category = find(id);
        String name = dto.name().trim();
        var existing = repository.findByNameIgnoreCase(name);
        if (existing.isPresent() && !existing.get().getSeq().equals(id)) {
            throw ApiException.conflict("CATEGORY_EXISTS", "Já existe uma categoria com esse nome.", "name");
        }
        boolean wasActive = category.isActive();
        category.setName(name);
        category.setDescription(blankToNull(dto.description()));
        category.setInactive(dto.inactive() != null ? dto.inactive() : 0);
        repository.save(category);
        String action = wasActive == category.isActive() ? "EDICAO" : (category.isActive() ? "REATIVACAO" : "DESATIVACAO");
        audit.record("CATEGORIA", id, action, "Categoria " + name + " atualizada.");
        return toDTO(category, productRepository.countByCategory_Seq(id));
    }

    /** Move todos os produtos para outra categoria ativa (permite excluir a original sem inconsistencia). */
    @Transactional
    public CategoryResponse reassign(Integer id, Integer targetId) {
        Category source = find(id);
        if (id.equals(targetId)) {
            throw ApiException.unprocessable("SAME_CATEGORY", "Escolha uma categoria diferente.", "targetCategoryId");
        }
        Category target = find(targetId);
        if (!target.isActive()) {
            throw ApiException.unprocessable("CATEGORY_INACTIVE", "A categoria de destino está inativa.", "targetCategoryId");
        }
        int moved = entityManager.createQuery("update Product p set p.category = :target where p.category = :source")
                .setParameter("target", target)
                .setParameter("source", source)
                .executeUpdate();
        audit.record("CATEGORIA", id, "REATRIBUICAO",
                moved + " produto(s) movido(s) de " + source.getName() + " para " + target.getName() + ".");
        return toDTO(source, 0);
    }

    @Transactional
    public void delete(Integer id) {
        Category category = find(id);
        long productCount = productRepository.countByCategory_Seq(id);
        if (productCount > 0) {
            throw ApiException.conflict("CATEGORY_IN_USE", "A categoria possui " + productCount
                    + " produto(s). Desative-a ou reatribua os produtos antes de excluir.", null);
        }
        repository.delete(category);
        audit.record("CATEGORIA", id, "EXCLUSAO", "Categoria " + category.getName() + " excluída.");
    }

    private Category find(Integer id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("Categoria"));
    }

    private Map<Integer, Long> productCounts() {
        List<Object[]> rows = entityManager.createQuery(
                "select p.category.seq, count(p) from Product p group by p.category.seq", Object[].class).getResultList();
        return rows.stream().collect(Collectors.toMap(r -> (Integer) r[0], r -> (Long) r[1]));
    }

    private static CategoryResponse toDTO(Category c, long productCount) {
        int inactive = c.getInactive() == null ? 0 : c.getInactive();
        return new CategoryResponse(c.getSeq(), c.getName(), c.getDescription(), inactive, inactive == 0, productCount);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
