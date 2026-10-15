//! A small C ABI keeps the worklet independent of wasm-bindgen glue.
//! Handles and pointers belong to this module; only the worklet calls this ABI.
use std::f32::consts::PI;

const MAX_VOICES: usize = 256;
const MAX_BLOCK: usize = 2048;
const PARAM_COUNT: usize = 20;

#[derive(Clone, Copy, Default)]
struct Voice {
    remaining: u32,
    envelope: f32,
    decay: f32,
    left: f32,
    right: f32,
    b0: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

pub struct Engine {
    rate: f32,
    voice_limit: usize,
    rng: u32,
    params: [f32; PARAM_COUNT],
    output: [f32; MAX_BLOCK * 3],
    voices: [Voice; MAX_VOICES],
    pink: [f32; 7],
    phase: f64,
    time: f64,
    next_voice: usize,
}

fn bounded(value: f32, fallback: f32, min: f32, max: f32) -> f32 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

impl Engine {
    fn new(rate: f32, voices: u32, seed: u32) -> Self {
        let mut params = [0.0; PARAM_COUNT];
        params[0] = 30.0; // drops per second
        params[1] = 0.2; // decay seconds
        params[2] = 1.0; // Q
        params[4] = 300.0; // min pitch: value, enabled, amplitude, frequency
        params[8] = 800.0; // max pitch
        params[12] = 1.0; // pan range
        Self {
            rate: bounded(rate, 48000.0, 8000.0, 192000.0),
            voice_limit: (voices as usize).clamp(1, MAX_VOICES),
            rng: seed.max(1),
            params,
            output: [0.0; MAX_BLOCK * 3],
            voices: [Voice::default(); MAX_VOICES],
            pink: [0.0; 7],
            phase: 0.0,
            time: 0.0,
            next_voice: 0,
        }
    }

    fn random(&mut self) -> f32 {
        self.rng ^= self.rng << 13;
        self.rng ^= self.rng >> 17;
        self.rng ^= self.rng << 5;
        (self.rng >> 8) as f32 / 16777216.0
    }

    fn modulation(&self, offset: usize) -> f32 {
        let value = self.params[offset];
        if self.params[offset + 1] != 0.0 {
            value
                + (self.time * self.params[offset + 3] as f64 * 2.0 * std::f64::consts::PI).sin()
                    as f32
                    * self.params[offset + 2]
        } else {
            value
        }
    }

    fn configure(&mut self) {
        self.params[0] = bounded(self.params[0], 0.0, 0.0, 2000.0);
        self.params[1] = bounded(self.params[1], 0.2, 0.001, 10.0);
        self.params[2] = bounded(self.params[2], 1.0, 0.01, 100.0);
        for offset in [4, 8, 12] {
            for index in offset..offset + 4 {
                self.params[index] = bounded(self.params[index], 0.0, -100000.0, 100000.0);
            }
        }
    }

    fn spawn(&mut self) {
        // Prefer a free slot; steal in round-robin order when the pool is full.
        let index = (0..self.voice_limit)
            .map(|i| (self.next_voice + i) % self.voice_limit)
            .find(|&i| self.voices[i].remaining == 0)
            .unwrap_or(self.next_voice);
        self.next_voice = (index + 1) % self.voice_limit;
        let min = self.modulation(4);
        let max = self.modulation(8);
        let freq = bounded(
            min + self.random() * (max - min),
            400.0,
            20.0,
            self.rate * 0.45,
        );
        let pan_range = bounded(self.modulation(12), 1.0, 0.0, 1.0);
        let pan = (self.random() * 2.0 - 1.0) * pan_range;
        let angle = (pan + 1.0) * PI * 0.25;
        let omega = 2.0 * PI * freq / self.rate;
        let alpha = omega.sin() / (2.0 * self.params[2]);
        let inv_a0 = 1.0 / (1.0 + alpha);
        let samples = (self.params[1] * self.rate).max(1.0) as u32;
        self.voices[index] = Voice {
            remaining: samples,
            envelope: 1.0,
            decay: (0.001_f32.ln() / samples as f32).exp(),
            left: angle.cos(),
            right: angle.sin(),
            b0: alpha * inv_a0,
            b2: -alpha * inv_a0,
            a1: -2.0 * omega.cos() * inv_a0,
            a2: (1.0 - alpha) * inv_a0,
            z1: 0.0,
            z2: 0.0,
        };
    }

    fn process(&mut self, frames: usize) {
        for i in 0..frames.min(MAX_BLOCK) {
            self.phase += self.params[0] as f64 / self.rate as f64;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
                self.spawn();
            }
            let white = self.random() * 2.0 - 1.0;
            let noise = if self.params[3] != 0.0 {
                white
            } else {
                let p = &mut self.pink;
                p[0] = 0.99886 * p[0] + white * 0.0555179;
                p[1] = 0.99332 * p[1] + white * 0.0750759;
                p[2] = 0.969 * p[2] + white * 0.153852;
                p[3] = 0.8665 * p[3] + white * 0.3104856;
                p[4] = 0.55 * p[4] + white * 0.5329522;
                p[5] = -0.7616 * p[5] - white * 0.016898;
                let result = (p.iter().sum::<f32>() + white * 0.5362) * 0.11;
                p[6] = white * 0.115926;
                result
            };
            let mut left = 0.0;
            let mut right = 0.0;
            for v in 0..self.voice_limit {
                if self.voices[v].remaining == 0 {
                    continue;
                }
                let excitation = (self.random() * 2.0 - 1.0) * self.voices[v].envelope;
                let voice = &mut self.voices[v];
                let sample = voice.b0 * excitation + voice.z1;
                voice.z1 = -voice.a1 * sample + voice.z2;
                voice.z2 = voice.b2 * excitation - voice.a2 * sample;
                left += sample * voice.left;
                right += sample * voice.right;
                voice.envelope *= voice.decay;
                voice.remaining -= 1;
            }
            self.output[i] = noise;
            self.output[MAX_BLOCK + i] = left;
            self.output[MAX_BLOCK * 2 + i] = right;
            self.time += 1.0 / self.rate as f64;
        }
    }

    fn reset(&mut self) {
        self.voices.fill(Voice::default());
        self.pink.fill(0.0);
        self.output.fill(0.0);
        self.phase = 0.0;
        self.time = 0.0;
    }
}

#[no_mangle]
pub extern "C" fn engine_new(rate: f32, voices: u32, seed: u32) -> *mut Engine {
    Box::into_raw(Box::new(Engine::new(rate, voices, seed)))
}

// All unsafe entry points require a live handle from engine_new. The worklet
// owns it exclusively and never calls these functions after engine_free.
#[no_mangle]
/// # Safety
/// `handle` must be null or a live engine_new allocation, freed exactly once.
pub unsafe extern "C" fn engine_free(handle: *mut Engine) {
    if !handle.is_null() {
        drop(Box::from_raw(handle));
    }
}
#[no_mangle]
/// # Safety
/// `handle` must be live and exclusively owned. Write only PARAM_COUNT floats.
pub unsafe extern "C" fn engine_params_ptr(handle: *mut Engine) -> *mut f32 {
    (*handle).params.as_mut_ptr()
}
#[no_mangle]
/// # Safety
/// `handle` must be live. The result is valid only until engine_free; do not write.
pub unsafe extern "C" fn engine_output_ptr(handle: *mut Engine) -> *const f32 {
    (*handle).output.as_ptr()
}
#[no_mangle]
/// # Safety
/// `handle` must be live and exclusively owned, with no concurrent parameter writes.
pub unsafe extern "C" fn engine_configure(handle: *mut Engine) {
    (*handle).configure();
}
#[no_mangle]
/// # Safety
/// `handle` must be live and exclusively owned; call engine_configure after edits.
pub unsafe extern "C" fn engine_process(handle: *mut Engine, frames: usize) {
    (*handle).process(frames);
}
#[no_mangle]
/// # Safety
/// `handle` must be live and exclusively owned, with no concurrent rendering.
pub unsafe extern "C" fn engine_reset(handle: *mut Engine) {
    (*handle).reset();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_and_independent_of_block_size() {
        let mut a = Engine::new(48000.0, 32, 42);
        let mut b = Engine::new(48000.0, 32, 42);
        a.params[0] = 500.0;
        b.params[0] = 500.0;
        a.process(256);
        let expected = a.output;
        for offset in [0, 128] {
            b.process(128);
            for channel in 0..3 {
                assert_eq!(
                    expected[channel * MAX_BLOCK + offset..channel * MAX_BLOCK + offset + 128],
                    b.output[channel * MAX_BLOCK..channel * MAX_BLOCK + 128]
                );
            }
        }
    }

    #[test]
    fn overload_and_invalid_parameters_stay_finite() {
        let mut e = Engine::new(48000.0, 1, 0);
        e.params[0] = 2000.0;
        e.params[1] = f32::NAN;
        e.params[2] = 0.0;
        e.params[4] = f32::INFINITY;
        e.configure();
        for _ in 0..100 {
            e.process(MAX_BLOCK);
            assert!(e.output.iter().all(|x| x.is_finite()));
        }
        assert!(e.output[MAX_BLOCK..].iter().any(|x| x.abs() > 0.0));
    }

    #[test]
    fn zero_rate_and_reset_clear_drop_voices() {
        let mut e = Engine::new(48000.0, 16, 123);
        e.params[0] = 1000.0;
        e.process(128);
        e.reset();
        e.params[0] = 0.0;
        e.process(128);
        assert!(e.output[MAX_BLOCK..].iter().all(|x| *x == 0.0));
    }
}
