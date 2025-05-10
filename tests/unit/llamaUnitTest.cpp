// Minimal unit test for the LLaMA response generation function.

#include <cassert>
#include <iostream>
#include <string>
#include <llama.h>
#include "../integration/TestIntegration.cpp"

int main() {
    const char* model_path = "models/llama-3.2-3b-instruct.f16.gguf";

    // Initialize LLaMA model & context
    llama_model_params mparams = llama_model_default_params();
    llama_model* model = llama_model_load_from_file(model_path, mparams);
    assert(model && "Failed to load LLaMA model");

    llama_context_params cparams = llama_context_default_params();
    llama_context* ctx = llama_init_from_model(model, cparams);
    assert(ctx && "Failed to initialize LLaMA context");

    // Test prompt -> response
    std::string prompt = "Hello, how are you today?";
    std::string response = generate(ctx, model, prompt);

    std::cerr << "Response: '" << response << "'\n";
    assert(!response.empty() && "Generated response should not be empty");

    llama_free(ctx);
    llama_model_free(model);

    std::cout << "llamaUnitTest passed." << std::endl;
    return 0;
}
