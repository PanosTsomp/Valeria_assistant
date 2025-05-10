cmake_minimum_required(VERSION 3.20)
project(ValeriaAssistant LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

include(FetchContent)

#Fetch and build whisper.cpp and llama.cpp

FetchContent_Declare(
whisper
GIT_REPOSITORY https://github.com/ggerganov/whisper.cpp.git
GIT_TAG        master
)
FetchContent_Declare(
llama
GIT_REPOSITORY https://github.com/ggerganov/llama.cpp.git
GIT_TAG        master
)
FetchContent_MakeAvailable(whisper llama)

#Determine ggml target

if(TARGET ggml::ggml)
set(GGML_TARGET ggml::ggml)
elseif(TARGET ggml)
set(GGML_TARGET ggml)
else()
message(FATAL_ERROR "No GGML target found after building whisper.cpp")
endif()

#Include directories for our source files

include_directories(
${PROJECT_SOURCE_DIR}
${whisper_SOURCE_DIR}/include
${llama_SOURCE_DIR}/include
)

#Integration executable

add_executable(TestIntegration
tests/integration/TestIntegration.cpp
)
target_link_libraries(TestIntegration
PRIVATE whisper ${GGML_TARGET} llama pthread
)

#Whisper unit test

add_executable(whisperUnitTest
tests/unit/whisperUnitTest.cpp
)
target_link_libraries(whisperUnitTest
PRIVATE whisper ${GGML_TARGET} pthread
)

#LLaMA unit test

add_executable(llamaUnitTest
tests/unit/llamaUnitTest.cpp
)
target_link_libraries(llamaUnitTest
PRIVATE llama pthread
)