const marks = new Map();
const samples = [];
const MAX_SAMPLES = 80;

export function startMetric(name) {
    if (!name) return;
    marks.set(name, performance.now());
}

export function endMetric(name, detail = {}) {
    const startedAt = marks.get(name);
    if (startedAt == null) return null;
    marks.delete(name);
    const sample = {
        name,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        at: Date.now(),
        ...detail
    };
    samples.push(sample);
    if (samples.length > MAX_SAMPLES) samples.shift();
    window.dispatchEvent(new CustomEvent('codex:performance', { detail: sample }));
    return sample;
}

export function getPerformanceSamples() {
    return samples.map(sample => ({ ...sample }));
}

