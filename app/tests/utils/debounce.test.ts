import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "@/lib/utils/debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("solo invoca la función una vez tras la ventana de 300 ms (tecleo rápido)", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 300);

    debounced("A");
    vi.advanceTimersByTime(100);
    debounced("AC");
    vi.advanceTimersByTime(100);
    debounced("ACT");
    vi.advanceTimersByTime(100);

    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("ACT");
  });

  it("no invoca nada si el usuario deja de teclear dentro de la ventana", () => {
    const spy = vi.fn();
    const debounceFn = debounce(spy, 300);
    debounceFn("A");
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
  });

  it("cancel evita la ejecución pendiente", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 300);
    debounced("ACT");
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it("flush ejecuta de inmediato la última invocación pendiente", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 300);
    debounced("ACT-2026");
    debounced.flush();
    expect(spy).toHaveBeenCalledWith("ACT-2026");
  });

  it("permite invocaciones separadas después de la ventana", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 300);
    debounced("primero");
    vi.advanceTimersByTime(300);
    debounced("segundo");
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenNthCalledWith(1, "primero");
    expect(spy).toHaveBeenNthCalledWith(2, "segundo");
  });
});
