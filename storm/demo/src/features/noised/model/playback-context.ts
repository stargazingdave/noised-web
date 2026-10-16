type PlaybackNavigator = Navigator & {
    audioSession?: { type: string };
};

/** Must run synchronously in the Play/Export interaction, before loading assets. */
export function preparePlaybackContext(current: AudioContext | null) {
    const session = (navigator as PlaybackNavigator).audioSession;
    if (session) {
        // iOS otherwise treats Web Audio as ambient sound and obeys the silent switch.
        try { session.type = 'playback'; }
        catch { /* A browser/embedding policy may disallow changing the session. */ }
    }
    const context = current ?? new AudioContext();
    // Safari can report "interrupted" after another app takes the audio device.
    const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
    return { context, resumed };
}
