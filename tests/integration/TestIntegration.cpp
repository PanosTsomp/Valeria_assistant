/*
 * whisper_llama_example.cpp
 *
 * Demonstrates a pipeline:
 *   1) Transcribe a WAV audio file using Whisper (new init API).
 *   2) Generate a text response from the transcript using LLaMA.
 *
 * Usage:
 *   ./whisper_llama_example <audio.wav> <whisper-model> <llama-model>
 */

 #include <iostream>
 #include <fstream>
 #include <vector>
 #include <string>
 #include <cstdint>
 #include <cstring>      // for strncmp
 #include <thread>
 #include <whisper.h>
 #include <llama.h>
 
 // Load PCM16 audio (16kHz mono) from WAV or raw file into floats
 static std::vector<float> load_audio(const char* path) {
     std::ifstream in(path, std::ios::binary | std::ios::ate);
     if (!in) {
         std::cerr << "Error: cannot open '" << path << "'\n";
         return {};
     }
     auto size = in.tellg();
     in.seekg(0, std::ios::beg);
 
     char hdr[4];
     in.read(hdr, 4);
     bool is_wav = (strncmp(hdr, "RIFF", 4) == 0);
     if (is_wav) {
         in.seekg(44, std::ios::beg);
         size -= 44;
     } else {
         in.seekg(0, std::ios::beg);
     }
     if (size <= 0 || (size % sizeof(int16_t)) != 0) {
         std::cerr << "Error: invalid PCM16 size\n";
         return {};
     }
 
     std::vector<int16_t> buf(size / sizeof(int16_t));
     in.read(reinterpret_cast<char*>(buf.data()), size);
     if (!in) {
         std::cerr << "Error: failed reading PCM data\n";
         return {};
     }
 
     std::vector<float> audio;
     audio.reserve(buf.size());
     for (auto s : buf) audio.push_back(float(s) / 32768.0f);
     return audio;
 }
 
 // Transcribe audio via Whisper
 static std::string transcribe(whisper_context* ctx, const std::vector<float>& audio) {
     auto params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
     params.print_progress = true;
     params.print_special  = true;
     params.print_realtime = false;
     if (whisper_full(ctx, params, audio.data(), audio.size()) != 0) {
         std::cerr << "Error: Whisper transcription failed\n";
         return {};
     }
     std::string out;
     int n_seg = whisper_full_n_segments(ctx);
     for (int i = 0; i < n_seg; ++i) {
         const char* seg = whisper_full_get_segment_text(ctx, i);
         std::cerr << "[Seg " << i << "] " << seg << "\n";
         out += seg;
     }
     return out;
 }
 
 // Generate response via LLaMA (new batch API)
 static std::string generate(llama_context* ctx, llama_model* model, const std::string& prompt) {
     const llama_vocab* vocab = llama_model_get_vocab(model);
 
     // Tokenize prompt
     std::vector<llama_token> tokens(prompt.size() + 32);
     int32_t n = llama_tokenize(vocab, prompt.c_str(), 0,
                                tokens.data(), tokens.size(), true, false);
     if (n < 0) {
         std::cerr << "Error: tokenization failed\n";
         return {};
     }
     tokens.resize(n);
 
     // Feed each token
     for (llama_token tok : tokens) {
         llama_batch batch = llama_batch_init(1, /*embd=*/0, /*n_seq_max=*/1);
         if (llama_decode(ctx, batch) != 0) {
             std::cerr << "Error: feeding prompt token failed\n";
             llama_batch_free(batch);
             return {};
         }
         llama_batch_free(batch);
     }
 
     // Generate new tokens
     std::string resp;
     resp.reserve(256);
     for (int i = 0; i < 100; ++i) {
         llama_batch batch = llama_batch_init(1, /*embd=*/0, /*n_seq_max=*/1);
         if (llama_decode(ctx, batch) != 0) {
             llama_batch_free(batch);
             break;
         }
         llama_token tok = batch.token[0];
         llama_batch_free(batch);
         if (tok == llama_vocab_eos(vocab)) break;
         char buf[256] = {0};
         int len = llama_token_to_piece(vocab, tok, buf, sizeof(buf), 0, false);
         if (len < 0) break;
         resp.append(buf, len);
     }
     return resp;
 }
 
 int main(int argc, char** argv) {
     const char* audio  = (argc > 1 ? argv[1] : "tests/Voice.wav");
     const char* wmodel = (argc > 2 ? argv[2] : "models/ggml-medium-q8_0.bin");
     const char* lmodel = (argc > 3 ? argv[3] : "models/llama-3.2-3b-instruct.gguf");
 
     // Whisper init with new API
     whisper_context_params wip = whisper_context_default_params();
     wip.use_gpu    = true;
     wip.gpu_device = 0;
     wip.flash_attn = false;
     whisper_context* wctx = whisper_init_from_file_with_params_no_state(wmodel, wip);
     if (!wctx) {
         std::cerr << "Error: init Whisper failed\n";
         return 1;
     }
 
     auto audio_data = load_audio(audio);
     if (audio_data.empty()) return 1;
     auto txt = transcribe(wctx, audio_data);
     whisper_free(wctx);
     if (txt.empty()) return 1;
     std::cout << "[Transcription] " << txt << "\n";
 
     // LLaMA init
     llama_model_params mp = llama_model_default_params();
     llama_model* model = llama_model_load_from_file(lmodel, mp);
     if (!model) {
         std::cerr << "Error: load LLaMA failed\n";
         return 1;
     }
     llama_context_params cip = llama_context_default_params();
     llama_context* ctx = llama_init_from_model(model, cip);
     if (!ctx) {
         std::cerr << "Error: init LLaMA context failed\n";
         llama_model_free(model);
         return 1;
     }
 
     auto reply = generate(ctx, model, txt);
     std::cout << "[LLaMA response] " << reply << "\n";
 
     llama_free(ctx);
     llama_model_free(model);
     return 0;
 }
 