import { afterEach, describe, expect, it, vi } from 'vitest';
import { preparePlaybackContext } from './playback-context';

afterEach(() => vi.unstubAllGlobals());

describe('playback audio session', () => {
    it('selects media playback before creating and resuming audio in the tap handler', async () => {
        const calls: string[] = [];
        vi.stubGlobal('navigator', { audioSession: { set type(value: string) { calls.push(value); } } });
        const context = { state: 'suspended', resume: vi.fn(() => { calls.push('resume'); return Promise.resolve(); }) };
        vi.stubGlobal('AudioContext', class { constructor() { calls.push('create'); return context; } });
        const prepared = preparePlaybackContext(null);
        expect(calls).toEqual(['playback', 'create', 'resume']);
        expect(prepared.context).toBe(context);
        await prepared.resumed;
    });

    it('resumes an existing interrupted Safari context without creating another one', async () => {
        vi.stubGlobal('navigator', {});
        const resume = vi.fn().mockResolvedValue(undefined);
        const context = { state: 'interrupted', resume } as unknown as AudioContext;
        const prepared = preparePlaybackContext(context);
        expect(prepared.context).toBe(context);
        expect(resume).toHaveBeenCalledOnce();
        await prepared.resumed;
    });

    it('leaves a running context running when the session API is unavailable', async () => {
        vi.stubGlobal('navigator', {});
        const context = { state: 'running', resume: vi.fn() } as unknown as AudioContext;
        await preparePlaybackContext(context).resumed;
        expect(context.resume).not.toHaveBeenCalled();
    });

    it('still resumes audio if setting the optional session type is denied', async () => {
        vi.stubGlobal('navigator', { audioSession: { set type(_value: string) { throw new Error('Denied'); } } });
        const context = { state: 'suspended', resume: vi.fn().mockResolvedValue(undefined) } as unknown as AudioContext;
        await preparePlaybackContext(context).resumed;
        expect(context.resume).toHaveBeenCalledOnce();
    });
});
