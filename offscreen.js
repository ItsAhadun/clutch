// Transcribes Reels that have no Instagram captions with Whisper, on this computer's CPU.
// An offscreen document, not the service worker: it needs AudioContext to decode the video,
// and it keeps the model loaded between Reels. sw.js opens it; video.js talks to it over a port.
import { env, pipeline, read_audio } from "./vendor/transformers.min.js";

// MV3 can't run code from the web, so ONNX Runtime ships in vendor/. Only the model weights are
// downloaded, once, and then come from the Cache API.
// The plain CPU build: half the size of the default WebGPU-capable one, same speed on CPU.
env.backends.onnx.wasm.wasmPaths = {
  mjs: chrome.runtime.getURL("vendor/ort-wasm-simd-threaded.mjs"),
  wasm: chrome.runtime.getURL("vendor/ort-wasm-simd-threaded.wasm"),
};
env.useWasmCache = false; // that cache imports the runtime from a blob: URL, which extension CSP blocks
// ONNX Runtime defaults to 4 threads; 8 was ~25% faster on a 12-thread laptop CPU. Threads need
// cross-origin isolation, which the manifest's COOP/COEP keys give extension pages.
env.backends.onnx.wasm.numThreads = Math.min(8, navigator.hardwareConcurrency);

const CHUNK = 30, STRIDE = 5; // seconds, as the pipeline splits long audio

// Multilingual base, 8-bit: ~80 MB, and about half a Reel's length to transcribe on a laptop CPU.
// ponytail: whisper-small (~250 MB) transcribes better if base isn't good enough.
let asr;
let report = () => {}; // the latest request's progress, which the shared model load reports into
const mb = n => Math.round(n / 1e6);
const load = () => asr ??= pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
  device: "wasm", dtype: "q8",
  // Fires for cache reads too, hence "loading". Only the first time is it a real download.
  progress_callback: i => i.status === "progress_total" && i.total &&
    report(`Loading the speech model: ${mb(i.loaded)} of ${mb(i.total)} MB (downloaded only the first time)`,
           i.loaded / i.total),
}).catch(e => { asr = null; throw e; });

// status(text, fraction): fraction is 0–1, or undefined while there's nothing to measure.
export async function transcribe(url, status = () => {}) {
  report = status;
  status("Getting the Reel's audio…");
  const [audio, asr] = await Promise.all([read_audio(url, 16000), load()]);

  // transformers.js assumes English unless told the language, and a separate detection pass would
  // cost a whole extra encoder run. So start each 30 s chunk with only start-of-transcript and steer
  // the next three tokens the way Whisper itself does: the language it hears, transcribe, no timestamps.
  const g = asr.model.generation_config;
  const langs = Object.values(g.lang_to_id);
  const jump = (CHUNK - 2 * STRIDE) * 16000;
  const parts = 1 + Math.max(0, Math.ceil((audio.length - CHUNK * 16000) / jump));
  let lang, part = 0;
  const prefix = (ids, logits) => {
    for (let i = 0; i < ids.length; i++) {
      const d = logits[i].data, step = ids[i].length;
      if (step === 1) { // a new chunk starts; a single chunk has no progress to measure
        part++;
        if (parts > 1) status(`Transcribing on this computer: part ${part} of ${parts}…`, (part - 1) / parts);
        else status("Transcribing on this computer…");
        const keep = langs.map(t => d[t]);
        d.fill(-Infinity);
        langs.forEach((t, j) => d[t] = keep[j]);
      } else if (step === 2 || step === 3) {
        lang ??= Number(ids[i][1]);
        d.fill(-Infinity);
        d[step === 2 ? g.task_to_id.transcribe : g.no_timestamps_token_id] = 0;
      }
    }
    return logits;
  };
  const { text } = await asr(audio, { decoder_input_ids: [g.decoder_start_token_id], logits_processor: [prefix],
                                      chunk_length_s: CHUNK, stride_length_s: STRIDE });
  return { text: text.trim(), language: lang && asr.tokenizer.decode([lang]).slice(2, -2) }; // "<|ur|>" -> "ur"
}

// Only Instagram's video CDN: the manifest grants host access there so this page can fetch the file.
const CDN = /^https:\/\/[\w.-]+\.(cdninstagram\.com|fbcdn\.net)\//;

// A port, not sendMessage, so progress can stream back before the result.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "transcribe" || !port.sender?.tab) return;
  const send = m => { try { port.postMessage(m); } catch {} }; // the tab may have closed the panel or left
  port.onMessage.addListener(async ({ url }) => {
    if (!CDN.test(url)) return send({ error: "that isn't an Instagram video file" });
    try { send({ result: await transcribe(url, (text, progress) => send({ status: text, progress })) }); }
    catch (e) { send({ error: e.message }); }
  });
});
