package com.gestaoInvetario.application.security;

import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Converte o JWT em AuthUser relendo o usuario no banco: desativacoes e mudancas de papel
 * passam a valer imediatamente, sem esperar o token expirar.
 */
@Component
public class UserAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AppUserRepository users;

    public UserAuthenticationConverter(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AppUser user = users.findByUsernameIgnoreCase(jwt.getSubject())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new DisabledException("Usuário inexistente ou desativado."));
        AuthUser principal = new AuthUser(user.getId(), user.getUsername(), user.getName(), user.getRole());
        return new UserAuthenticationToken(principal, jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

    static final class UserAuthenticationToken extends AbstractAuthenticationToken {
        private final AuthUser principal;
        private final Jwt jwt;

        UserAuthenticationToken(AuthUser principal, Jwt jwt, List<SimpleGrantedAuthority> authorities) {
            super(authorities);
            this.principal = principal;
            this.jwt = jwt;
            setAuthenticated(true);
        }

        @Override
        public Object getCredentials() {
            return jwt;
        }

        @Override
        public Object getPrincipal() {
            return principal;
        }

        @Override
        public String getName() {
            return principal.username();
        }
    }
}
