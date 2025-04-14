include(FetchContent)

cmake_minimum_required(VERSION 3.16)
project(valeria_assistant)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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

# Add your source files
add_executable(valeria_app src/main.cpp)

# Link the libraries
target_link_libraries(valeria_app PRIVATE whisper llama)