// Helper seguro para tentar voltar ao topo do stack sem lançar erro
import { createNavigationContainerRef } from '@react-navigation/native';

// NavigationContainer global ref (top-level) — usado para ações que precisam
// afetar a navegação raiz mesmo quando o `navigation` atual não contém a rota.
export const rootNavigationRef = createNavigationContainerRef<any>();

export function navigateRoot(routeName: string, params?: any) {
  try {
    if (!rootNavigationRef.isReady()) return false;
    // Verifica se a rota está exposta pelo navigator raiz antes de navegar
    let state: any = undefined;
    try { state = (rootNavigationRef.getRootState ? rootNavigationRef.getRootState() : rootNavigationRef.getState()); } catch (e) { /* ignore */ }
    const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
    if (!routeNames || !routeNames.includes(routeName)) {
      console.warn('navigateRoot: rota não encontrada no navigator raiz — pulando navegação:', routeName);
      return false;
    }
    rootNavigationRef.navigate(routeName as any, params);
    return true;
  } catch (err) {
    console.warn('navigateRoot failed', err);
    return false;
  }
}

export function resetRoot(routeName: string, params?: any) {
  try {
    if (!rootNavigationRef.isReady()) return false;
    // Verifica se a rota existe no navigator raiz antes de resetar
    let state: any = undefined;
    try { state = (rootNavigationRef.getRootState ? rootNavigationRef.getRootState() : rootNavigationRef.getState()); } catch (e) { /* ignore */ }
    const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
    if (!routeNames || !routeNames.includes(routeName)) {
      console.warn('resetRoot: rota não encontrada no navigator raiz — pulando reset:', routeName);
      return false;
    }
    rootNavigationRef.reset({ index: 0, routes: [{ name: routeName as any, params }] });
    return true;
  } catch (err) {
    console.warn('resetRoot failed', err);
    return false;
  }
}

/**
 * Aguarda até que a rota exista no navigator raiz e então faz reset.
 * Evita WARNs causados por reset ser chamado antes do App trocar de navigator.
 */
export async function resetRootWhenAvailable(routeName: string, opts?: { timeoutMs?: number, intervalMs?: number }) {
  const timeoutMs = (opts && opts.timeoutMs) || 5000; // give more time by default
  const intervalMs = (opts && opts.intervalMs) || 120;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (!rootNavigationRef.isReady()) {
        // esperar um pouco
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      let state: any = undefined;
      try { state = (rootNavigationRef.getRootState ? rootNavigationRef.getRootState() : rootNavigationRef.getState()); } catch (e) { /* ignore */ }
      const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);

      if (routeNames && routeNames.includes(routeName)) {
        try {
          rootNavigationRef.reset({ index: 0, routes: [{ name: routeName as any }] });
          return true;
        } catch (err) {
          // se reset falhar por algum motivo, retornar false
          console.warn('resetRootWhenAvailable: reset falhou', err);
          return false;
        }
      }

      // aguardar e tentar novamente
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    } catch (err) {
      // silencioso — continuamos tentando até timeout
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  // timed out
  return false;
}

/**
 * Aguarda até que a rota exista no navigator raiz e então tenta navegar.
 */
export async function navigateRootWhenAvailable(routeName: string, params?: any, opts?: { timeoutMs?: number, intervalMs?: number }) {
  const timeoutMs = (opts && opts.timeoutMs) || 5000;
  const intervalMs = (opts && opts.intervalMs) || 120;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (!rootNavigationRef.isReady()) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      let state: any = undefined;
      try { state = (rootNavigationRef.getRootState ? rootNavigationRef.getRootState() : rootNavigationRef.getState()); } catch (e) { /* ignore */ }
      const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);

      if (routeNames && routeNames.includes(routeName)) {
        try {
          rootNavigationRef.navigate(routeName as any, params);
          return true;
        } catch (err) {
          console.warn('navigateRootWhenAvailable: navigate failed', err);
          return false;
        }
      }

      // espera e tenta de novo
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return false;
}

export function safePopToTop(navigation: any, fallbackRouteName?: string) {
  try {
    if (!navigation) return;

    // Debug: quais métodos o objeto navigation expõe
    try {
      const keys = Object.keys(navigation || {});
      console.debug("safePopToTop: navigation keys:", keys);
    } catch (e) {
      console.debug("safePopToTop: could not enumerate navigation keys", e);
    }

    // Avoid calling navigation.popToTop() because some navigator setups
    // dispatch a POP_TO_TOP action that may be unhandled and surface
    // a runtime error. Prefer reset/navigation fallbacks instead.
    console.debug("safePopToTop: skipping navigation.popToTop() to avoid POP_TO_TOP dispatch");

    // Tenta resetar o estado para a rota raiz (se reset estiver disponível)
    // Try resetting this navigator (preferred) or its parent
    const resetTarget =
      (typeof navigation.reset === "function" && navigation) ||
      (typeof navigation.getParent === "function" && navigation.getParent());

    if (resetTarget && typeof resetTarget.reset === "function") {
      console.debug("safePopToTop: attempting reset on", resetTarget === navigation ? "navigation" : "parent navigation", "to", fallbackRouteName);
      try {
        // Antes de resetar, verificar se a rota existe no target
        let routeNames: string[] = [];
        try {
          const state = resetTarget.getState ? resetTarget.getState() : undefined;
          routeNames = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
        } catch (err) {
          console.debug('safePopToTop: não foi possível obter state do resetTarget', err);
        }

        if (fallbackRouteName) {
          // Somente resetar se o resetTarget conhece a rota solicitada
          if (routeNames && routeNames.includes(fallbackRouteName)) {
            resetTarget.reset({ index: 0, routes: [{ name: fallbackRouteName }] });
            return;
          } else {
            console.debug('safePopToTop: fallbackRouteName não encontrada no resetTarget, pulando reset');
          }
        } else if (routeNames && routeNames.includes('HomePassageiro')) {
          // Se não foi fornecido fallback, só resetar se o target já expõe HomePassageiro
          resetTarget.reset({ index: 0, routes: [{ name: 'HomePassageiro' }] });
          return;
        } else {
          console.debug('safePopToTop: fallbackRouteName não encontrada no resetTarget, pulando reset');
        }
      } catch (e) {
        console.warn("safePopToTop: reset failed, falling back:", e);
      }
    } else {
      console.debug("safePopToTop: no reset available on navigation or parent");
    }

    // Por fim tenta navegar para a rota fallback — preferir o navigator raiz
    if (fallbackRouteName) {
      // primeiro tente navegar via root (se exposta)
      try {
        if (navigateRoot(fallbackRouteName)) return;
      } catch (e) {
        // continue to local fallback
      }
    }

    if (fallbackRouteName && typeof navigation.navigate === "function") {
      console.debug("safePopToTop: attempting navigation.navigate to", fallbackRouteName);
      try {
        navigation.navigate(fallbackRouteName);
        return;
      } catch (e) {
        console.warn("safePopToTop: navigate fallback failed:", e);
      }
    } else {
      console.debug("safePopToTop: navigation.navigate not a function or no fallbackRouteName provided");
    }

    console.debug("safePopToTop: no suitable navigation action available");
  } catch (err) {
    console.error("safePopToTop: unexpected error", err);
  }
}

// Tentativa segura de navegar para uma rota nomeada, procurando por parents
export function navigateToRoute(navigation: any, routeName: string) {
  try {
    if (!navigation || !routeName) return false;

    // Tenta navegar direto se a rota existir no navigation atual
    try {
      const state = navigation.getState ? navigation.getState() : undefined;
      const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
      if (routeNames && routeNames.includes(routeName) && typeof navigation.navigate === 'function') {
        navigation.navigate(routeName);
        return true;
      }
    } catch (err) {
      // seguir para tentar no parent
    }

    // Se não achou, tenta subir na hierarquia de parents
    let parent = typeof navigation.getParent === 'function' ? navigation.getParent() : null;
    while (parent) {
      try {
        const state = parent.getState ? parent.getState() : undefined;
        const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
        if (routeNames && routeNames.includes(routeName) && typeof parent.navigate === 'function') {
          parent.navigate(routeName);
          return true;
        }
      } catch (err) {
        // ignore and continue up
      }
      parent = typeof parent.getParent === 'function' ? parent.getParent() : null;
    }

    // Não tentar um `navigate` final sem confirmação — isso gera a mensagem
    // "The action 'NAVIGATE' with payload {..} was not handled by any navigator.".
    // Em vez disso, procuramos o ancestor mais alto que contenha a rota e
    // chamamos `navigate` apenas se a rota existir naquele ancestor.
    try {
      // procura pelo ancestor mais alto
      let root: any = navigation;
      while (root && typeof root.getParent === 'function') {
        const parent = root.getParent();
        if (!parent) break;
        root = parent;
      }

      if (root) {
        try {
          const state = root.getState ? root.getState() : undefined;
          const routeNames: string[] = (state && (state as any).routeNames) || (state && (state as any).routes ? (state as any).routes.map((r: any) => r.name) : []);
          if (routeNames && routeNames.includes(routeName) && typeof root.navigate === 'function') {
            root.navigate(routeName);
            return true;
          }
        } catch (err) {
          // se root.getState falhar, não prossegue — vamos evitar disparar navigate às cegas
        }
      }
    } catch (err) {
      // ignore
    }

    console.warn('navigateToRoute: rota não encontrada em nenhum ancestor — pulando navigate para', routeName);
    return false;
  } catch (err) {
    console.error('navigateToRoute: erro inesperado', err);
    return false;
  }
}
