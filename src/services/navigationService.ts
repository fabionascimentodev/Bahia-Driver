// Helper seguro para tentar voltar ao topo do stack sem lançar erro
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

        if (!fallbackRouteName || (routeNames && routeNames.includes(fallbackRouteName))) {
          resetTarget.reset({ index: 0, routes: [{ name: fallbackRouteName || "HomePassageiro" }] });
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

    // Por fim tenta navegar para a rota fallback
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

    // Como último recurso, tenta chamar navigate direto e confia que vai falhar graciosamente
    try {
      if (typeof navigation.navigate === 'function') {
        navigation.navigate(routeName);
        return true;
      }
    } catch (err) {
      // nothing
    }

    console.warn('navigateToRoute: não foi possível navegar para', routeName);
    return false;
  } catch (err) {
    console.error('navigateToRoute: erro inesperado', err);
    return false;
  }
}
