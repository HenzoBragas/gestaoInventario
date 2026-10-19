package com.gestaoInvetario.application.config;

import com.gestaoInvetario.application.model.AppSettings;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.Location;
import com.gestaoInvetario.application.model.LocationType;
import com.gestaoInvetario.application.model.MovementType;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.model.Role;
import com.gestaoInvetario.application.model.StockBalance;
import com.gestaoInvetario.application.model.StockMovement;
import com.gestaoInvetario.application.model.Supplier;
import com.gestaoInvetario.application.repositories.AppSettingsRepository;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import com.gestaoInvetario.application.repositories.StockMovementRepository;
import com.gestaoInvetario.application.repositories.SupplierRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Random;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Executado apos o data.sql. Idempotente:
 * 1. garante configuracoes, administrador inicial e localizacoes padrao;
 * 2. (uma unica vez, se DEMO_DATA != false) gera dados de demonstracao: custos, fornecedores e um
 *    historico de movimentacoes de 90 dias reconstruido de tras para frente a partir do saldo atual,
 *    de modo que os saldos continuem exatamente iguais a soma das movimentacoes;
 * 3. migra produtos com saldo e sem saldo por localizacao para o deposito principal.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    static final String DEMO_USER = "demo";
    static final String DEMO_USER_NAME = "Carga de demonstração";
    static final String DEMO_REFERENCE = "DEMO";

    private final AppSettingsRepository settingsRepository;
    private final AppUserRepository users;
    private final LocationRepository locations;
    private final SupplierRepository suppliers;
    private final ProductRepository products;
    private final StockBalanceRepository balances;
    private final StockMovementRepository movements;
    private final PasswordEncoder passwordEncoder;
    private final boolean demoEnabled;

    public DataInitializer(AppSettingsRepository settingsRepository, AppUserRepository users,
                           LocationRepository locations, SupplierRepository suppliers, ProductRepository products,
                           StockBalanceRepository balances, StockMovementRepository movements,
                           PasswordEncoder passwordEncoder, @Value("${app.demo-data.enabled:true}") boolean demoEnabled) {
        this.settingsRepository = settingsRepository;
        this.users = users;
        this.locations = locations;
        this.suppliers = suppliers;
        this.products = products;
        this.balances = balances;
        this.movements = movements;
        this.passwordEncoder = passwordEncoder;
        this.demoEnabled = demoEnabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppSettings settings = settingsRepository.findById(AppSettings.SINGLETON_ID)
                .orElseGet(() -> settingsRepository.save(new AppSettings()));
        ensureAdmin();
        Location main = ensureLocations();

        if (demoEnabled && !settings.isDemoDataLoaded() && movements.count() == 0 && products.count() > 0) {
            loadDemoData(main);
            settings.setDemoDataLoaded(true);
            settingsRepository.save(settings);
        }
        migrateLegacyStock(main);
    }

    /** Cria o administrador inicial apenas se ainda nao existir nenhum usuario. */
    private void ensureAdmin() {
        if (users.count() > 0) return;
        AppUser admin = new AppUser();
        admin.setUsername("inventario");
        admin.setName("Administrador");
        admin.setEmail("admin@inventario.local");
        admin.setRole(Role.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode("inventario123"));
        users.save(admin);
        log.info("Usuario administrador inicial criado (login: inventario).");
    }

    private Location ensureLocations() {
        if (locations.count() == 0) {
            locations.save(location("DEP-01", "Depósito Principal", LocationType.WAREHOUSE, "Armazenagem principal de mercadorias."));
            locations.save(location("LOJ-01", "Loja · Área de vendas", LocationType.STORE, "Estoque exposto para venda."));
            locations.save(location("AVA-01", "Avarias e devoluções", LocationType.INTERNAL_AREA, "Itens em análise ou avariados."));
        }
        return locations.findByCodeIgnoreCase("DEP-01")
                .orElseGet(() -> locations.findAll().stream().min(Comparator.comparing(Location::getId)).orElseThrow());
    }

    private static Location location(String code, String name, LocationType type, String description) {
        Location l = new Location();
        l.setCode(code);
        l.setName(name);
        l.setType(type);
        l.setDescription(description);
        return l;
    }

    /** Produtos com saldo mas sem registro por localizacao recebem o saldo no deposito principal. */
    private void migrateLegacyStock(Location main) {
        Instant now = Instant.now();
        int migrated = 0;
        for (Product p : products.findAll()) {
            if (p.stockOrZero() <= 0 || !balances.findByProductId(p.getId()).isEmpty()) continue;
            StockBalance balance = new StockBalance(p, main);
            balance.setQuantity(p.stockOrZero());
            balances.save(balance);
            StockMovement m = movement(MovementType.IN, p, p.stockOrZero(), p.stockOrZero(), null, main, "Saldo inicial (migração)", now);
            m.setTotalBefore(0);
            m.setTotalAfter(p.stockOrZero());
            m.setToBefore(0);
            m.setToAfter(p.stockOrZero());
            m.setUsername("sistema");
            m.setUserDisplayName("Migração automática");
            m.setReference(null);
            movements.save(m);
            migrated++;
        }
        if (migrated > 0) log.info("{} produto(s) com saldo migrado(s) para {}.", migrated, main.getCode());
    }

    // ------------------------------------------------------------------ dados de demonstracao

    private void loadDemoData(Location main) {
        Random random = new Random(42); // deterministico: a mesma base gera sempre os mesmos dados
        Location store = locations.findByCodeIgnoreCase("LOJ-01").orElse(main);
        List<Supplier> demoSuppliers = ensureDemoSuppliers();
        Instant now = Instant.now();
        Instant start = now.minus(Duration.ofDays(90));
        List<StockMovement> generated = new ArrayList<>();

        List<Product> all = products.findAll();
        all.sort(Comparator.comparing(Product::getId));
        for (Product p : all) {
            enrichProduct(p, random, demoSuppliers, main, now);

            int total = p.stockOrZero();
            int storeQty = total >= 4 ? (int) Math.round(total * (0.2 + random.nextDouble() * 0.2)) : 0;
            int mainQty = total - storeQty;

            // Reconstrucao de tras para frente: cada evento desfaz seu efeito no estado (deposito, loja).
            int events = 2 + random.nextInt(total > 0 ? 6 : 4);
            List<Instant> times = new ArrayList<>();
            for (int i = 0; i < events; i++) {
                long offset = (long) (random.nextDouble() * Duration.between(start, now.minus(Duration.ofHours(2))).toSeconds());
                times.add(start.plusSeconds(offset));
            }
            times.sort(Comparator.reverseOrder());

            List<int[]> backwards = new ArrayList<>(); // {tipo, quantidade, origem(0=dep,1=loja), indice do tempo}
            int dep = mainQty, loja = storeQty;
            for (int i = 0; i < times.size(); i++) {
                double roll = random.nextDouble();
                if (roll < 0.30 && dep > 0) {
                    int q = Math.min(dep, 5 + random.nextInt(20));            // entrada no deposito
                    dep -= q;
                    backwards.add(new int[]{0, q, 0, i});
                } else if (roll < 0.50 && loja > 0) {
                    int q = Math.min(loja, 2 + random.nextInt(8));            // transferencia deposito -> loja
                    loja -= q;
                    dep += q;
                    backwards.add(new int[]{2, q, 0, i});
                } else {
                    int q = 1 + random.nextInt(4);                            // saida (venda)
                    boolean fromStore = random.nextDouble() < 0.6;
                    if (fromStore) loja += q; else dep += q;
                    backwards.add(new int[]{1, q, fromStore ? 1 : 0, i});
                }
            }

            // Estado mais antigo vira o "Saldo inicial", antes de todos os eventos.
            int runningTotal = 0;
            int depBal = 0, lojaBal = 0;
            Instant initialAt = start.minus(Duration.ofDays(1));
            if (dep > 0) {
                StockMovement m = movement(MovementType.IN, p, dep, dep, null, main, "Saldo inicial", initialAt);
                m.setTotalBefore(0); m.setTotalAfter(dep); m.setToBefore(0); m.setToAfter(dep);
                generated.add(m);
                depBal = dep;
                runningTotal = dep;
            }
            if (loja > 0) {
                StockMovement m = movement(MovementType.IN, p, loja, loja, null, store, "Saldo inicial", initialAt);
                m.setTotalBefore(runningTotal); m.setTotalAfter(runningTotal + loja); m.setToBefore(0); m.setToAfter(loja);
                generated.add(m);
                lojaBal = loja;
                runningTotal += loja;
            }

            for (int i = backwards.size() - 1; i >= 0; i--) {
                int[] e = backwards.get(i);
                Instant at = times.get(e[3]);
                int q = e[1];
                StockMovement m;
                switch (e[0]) {
                    case 0 -> {
                        m = movement(MovementType.IN, p, q, q, null, main, "Compra de fornecedor", at);
                        m.setToBefore(depBal); depBal += q; m.setToAfter(depBal);
                    }
                    case 2 -> {
                        m = movement(MovementType.TRANSFER, p, q, 0, main, store, "Reposição da loja", at);
                        m.setFromBefore(depBal); m.setToBefore(lojaBal);
                        depBal -= q; lojaBal += q;
                        m.setFromAfter(depBal); m.setToAfter(lojaBal);
                    }
                    default -> {
                        Location from = e[2] == 1 ? store : main;
                        m = movement(MovementType.OUT, p, q, -q, from, null, "Venda", at);
                        if (e[2] == 1) { m.setFromBefore(lojaBal); lojaBal -= q; m.setFromAfter(lojaBal); }
                        else { m.setFromBefore(depBal); depBal -= q; m.setFromAfter(depBal); }
                    }
                }
                m.setTotalBefore(runningTotal);
                runningTotal += m.getDelta();
                m.setTotalAfter(runningTotal);
                generated.add(m);
            }

            if (depBal != mainQty || lojaBal != storeQty || runningTotal != total) {
                throw new IllegalStateException("Inconsistencia na carga de demonstracao do produto " + p.getId());
            }
            saveBalance(p, main, mainQty);
            if (store != main) saveBalance(p, store, storeQty);
        }
        products.saveAll(all);
        movements.saveAll(generated);
        log.info("Carga de demonstracao: {} movimentacoes geradas para {} produtos.", generated.size(), all.size());
    }

    private void enrichProduct(Product p, Random random, List<Supplier> demoSuppliers, Location main, Instant now) {
        if (p.unitCostOrZero().signum() == 0) {
            double cost = Math.exp(Math.log(4.9) + random.nextDouble() * (Math.log(240) - Math.log(4.9)));
            BigDecimal unitCost = BigDecimal.valueOf(cost).setScale(2, RoundingMode.HALF_UP);
            p.setUnitCost(unitCost);
            p.setSalePrice(unitCost.multiply(BigDecimal.valueOf(1.6 + random.nextDouble() * 0.6))
                    .setScale(0, RoundingMode.HALF_UP).subtract(new BigDecimal("0.10")));
        }
        if (p.getSupplier() == null) p.setSupplier(demoSuppliers.get(p.getId() % demoSuppliers.size()));
        if (p.getDefaultLocation() == null) p.setDefaultLocation(main);
        if (p.getUnit() == null) p.setUnit("UN");
        if (p.getMinStock() == null) p.setMinStock(5);
        if (p.getActive() == null) p.setActive(true);
        if (p.getCreatedAt() == null) p.setCreatedAt(Date.from(now.minus(Duration.ofDays(100 + random.nextInt(120)))));
    }

    private List<Supplier> ensureDemoSuppliers() {
        String[][] data = {
                {"Distribuidora Horizonte (demo)", "contato@horizonte.exemplo", "(11) 3000-1000"},
                {"Casa & Utilidades Atacado (demo)", "vendas@casautil.exemplo", "(21) 3000-2000"},
                {"Eletro Norte Comércio (demo)", "comercial@eletronorte.exemplo", "(31) 3000-3000"},
                {"Importadora Prisma (demo)", "pedidos@prisma.exemplo", "(41) 3000-4000"},
        };
        List<Supplier> result = new ArrayList<>();
        for (String[] row : data) {
            result.add(suppliers.findByNameIgnoreCase(row[0]).orElseGet(() -> {
                Supplier s = new Supplier();
                s.setName(row[0]);
                s.setEmail(row[1]);
                s.setPhone(row[2]);
                s.setNotes("Fornecedor fictício criado pela carga de demonstração.");
                return suppliers.save(s);
            }));
        }
        return result;
    }

    private void saveBalance(Product p, Location location, int quantity) {
        StockBalance balance = balances.findByProduct_IdAndLocation_Id(p.getId(), location.getId())
                .orElseGet(() -> new StockBalance(p, location));
        balance.setQuantity(quantity);
        balances.save(balance);
    }

    private static StockMovement movement(MovementType type, Product p, int quantity, int delta, Location from,
                                          Location to, String reason, Instant at) {
        StockMovement m = new StockMovement();
        m.setType(type);
        m.setProduct(p);
        m.setQuantity(quantity);
        m.setDelta(delta);
        m.setFromLocation(from);
        m.setToLocation(to);
        m.setReason(reason);
        m.setReference(DEMO_REFERENCE);
        m.setUsername(DEMO_USER);
        m.setUserDisplayName(DEMO_USER_NAME);
        m.setCreatedAt(at);
        return m;
    }
}
