import css from './styles.css';

/** Called by the default entry; safe to import on the server. */
export function installStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    const existing = document.head.querySelector('style[data-noised-ui]');
    if (existing) {
        if (existing.textContent !== css) existing.textContent = css;
        return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-noised-ui', '');
    style.textContent = css;
    // Host styles keep precedence even when this package is loaded lazily.
    document.head.prepend(style);
}
