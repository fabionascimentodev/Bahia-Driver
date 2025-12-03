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
        resetTarget.reset({ index: 0, routes: [{ name: fallbackRouteName || "HomePassageiro" }] });
        return;
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
